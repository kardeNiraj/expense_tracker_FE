import { lazy, Suspense, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useExpense } from '../../context';
import {
    ApiError,
    queryKeys,
    remindSplitDebtorApi,
    useSpendings,
    useSplits,
    useSettleParticipantMutation,
    useTripInfo,
    usePeople,
    usePeopleDetails,
    usePushConfig,
    usePushStatus,
} from '../../api';
import {
    Avatar,
    PaymentModal,
    type PaymentSettlementData,
    CollectQrModal,
    type CollectQrModalData,
    GroupCollectQrModal,
    type GroupCollectQrModalData,
    SpendHistoryModal,
} from '../../components';
import { triggerHaptic } from '../../utils/haptics';
import { parseCustomDate, formatPurchaseTime, getCategoryMeta } from '../../utils/formatters';
import type { ParsedUpiQr } from '../../utils/qr';
import {
    computePersonalPairwiseBalances,
    type PairwiseSettlementRef,
} from '../../utils/pairwiseNetting';

const QrScannerModal = lazy(() => import('../../components/QRScanner/QrScannerModal'));
import {
    dismissPushPrompt,
    enablePushNotifications,
    getNotificationPermissionState,
    isIosSafariNotStandalone,
    isPushPausedLocally,
    isPushPromptDismissed,
    isPushSupported,
} from '../../utils/pushNotifications';

export function Dashboard() {
    const { activePerson, claimedPerson, isDeviceClaimed, setActiveTab, showToast } = useExpense();
    const queryClient = useQueryClient();
    const { data: spendings, isLoading: isSpendingsLoading } = useSpendings(activePerson);
    const { data: allSplits = [], isLoading: isSplitsLoading } = useSplits();
    const { data: tripInfo } = useTripInfo();
    const { data: people = [], refetch: refetchPeople } = usePeople();
    const { data: peopleDetails = [], refetch: refetchPeopleDetails } = usePeopleDetails();
    const { data: pushConfig } = usePushConfig(isDeviceClaimed);
    const { data: pushStatus } = usePushStatus(isDeviceClaimed);
    const [showSpendHistory, setShowSpendHistory] = useState(false);

    // Proactively fetch people and UPI details if not present on initial dashboard mount
    // Ensures UPI IDs and QR codes are ready offline even if user never visits the People tab
    useEffect(() => {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            if (people.length === 0) {
                refetchPeople().catch(() => {});
            }
            if (peopleDetails.length === 0) {
                refetchPeopleDetails().catch(() => {});
            }
        }
    }, [people.length, peopleDetails.length, refetchPeople, refetchPeopleDetails]);

    const settleMutation = useSettleParticipantMutation();
    const [paymentSettlement, setPaymentSettlement] = useState<PaymentSettlementData | null>(null);
    const [collectSettlement, setCollectSettlement] = useState<CollectQrModalData | null>(null);
    const [groupCollectData, setGroupCollectData] = useState<GroupCollectQrModalData | null>(null);
    const [showQrScanner, setShowQrScanner] = useState(false);
    const [settlingKey, setSettlingKey] = useState<string | null>(null);
    const [remindingKey, setRemindingKey] = useState<string | null>(null);
    const [expandedOwed, setExpandedOwed] = useState<Record<string, boolean>>({});
    const [expandedOwedToMe, setExpandedOwedToMe] = useState<Record<string, boolean>>({});
    const [expandedOffsets, setExpandedOffsets] = useState<Record<string, boolean>>({});
    const [isPushPromptDismissedState, setIsPushPromptDismissedState] = useState(() =>
        isPushPromptDismissed()
    );
    const [isEnablingPush, setIsEnablingPush] = useState(false);
    const [showIosPushGuide, setShowIosPushGuide] = useState(false);
    const [pushEnabledLocally, setPushEnabledLocally] = useState(false);

    const visibleSplits = allSplits.filter((s) => (s.status || 'ACTIVE').toUpperCase() !== 'DELETED');
    const activeSplits = visibleSplits.filter((s) => (s.status || 'ACTIVE').toUpperCase() === 'ACTIVE');

    // Date checker for today
    const isTodayDate = (dateStr?: string) => {
        const d = parseCustomDate(dateStr);
        if (!d) return false;
        const now = new Date();
        return (
            d.getDate() === now.getDate() &&
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear()
        );
    };

    // 1. Direct personal expenses logged by activePerson (excluding auto-recorded split rows)
    const directExpenseList = spendings?.allExpenses || spendings?.recentExpenses || [];
    const personalDirectExpenses = directExpenseList.filter(
        (exp) => !exp.description?.toLowerCase().includes('(split:')
    );

    // Sum of any auto-recorded split rows inside spendings to prevent double-counting
    const recordedSplitsInSheet = directExpenseList.filter((exp) =>
        exp.description?.toLowerCase().includes('(split:')
    );
    const recordedSplitsSum = recordedSplitsInSheet.reduce((sum, e) => sum + (e.amount || 0), 0);
    const recordedSplitsTodaySum = recordedSplitsInSheet
        .filter((e) => isTodayDate(e.timestamp))
        .reduce((sum, e) => sum + (e.amount || 0), 0);

    // 2. Split expenses where activePerson participated or paid upfront (excluding deleted splits)
    const userSplitItems = allSplits
        .filter((split) =>
            split.status?.toUpperCase() !== 'DELETED' &&
            (split.participants?.some(
                (p) => p.toLowerCase() === activePerson.toLowerCase()
            ) ||
            split.paidBy?.toLowerCase() === activePerson.toLowerCase())
        )
        .map((split) => {
            const isParticipant = split.participants?.some(
                (p) => p.toLowerCase() === activePerson.toLowerCase()
            );
            const count = split.participants?.length || 1;
            // Check if there is an explicit settlement for activePerson (e.g. custom shares or pairwise dues)
            const mySettlement = split.settlements?.find(
                (s) => s.from.toLowerCase() === activePerson.toLowerCase()
            );
            let myShare = 0;
            if (mySettlement) {
                myShare = mySettlement.amount;
            } else if (isParticipant) {
                if (split.paidBy?.toLowerCase() === activePerson.toLowerCase() && split.settlements?.length > 0) {
                    const othersOwe = split.settlements.reduce((sum, s) => sum + s.amount, 0);
                    myShare = Math.max(0, Math.round((split.totalAmount - othersOwe) * 100) / 100);
                } else {
                    myShare = Math.round((split.totalAmount / count) * 100) / 100;
                }
            }

            return {
                id: split.splitId,
                timestamp: split.timestamp,
                description: split.description,
                category: split.category,
                totalAmount: split.totalAmount,
                paidBy: split.paidBy,
                myShare,
                isToday: isTodayDate(split.timestamp),
            };
        });

    // 3. User's Personal Spend Totals
    // Deduct any auto-recorded split rows from spendings.total to isolate pure personal direct expenses
    const directTotal = typeof spendings?.directTotal === 'number'
        ? spendings.directTotal
        : typeof spendings?.total === 'number'
        ? Math.max(0, Math.round((spendings.total - recordedSplitsSum) * 100) / 100)
        : personalDirectExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const splitsTotal = userSplitItems.reduce((sum, s) => sum + s.myShare, 0);
    const userTotalSpend = Math.round((directTotal + splitsTotal) * 100) / 100;

    const directToday = typeof spendings?.directToday === 'number'
        ? spendings.directToday
        : typeof spendings?.today === 'number'
        ? Math.max(0, Math.round((spendings.today - recordedSplitsTodaySum) * 100) / 100)
        : personalDirectExpenses
            .filter((e) => isTodayDate(e.timestamp))
            .reduce((sum, e) => sum + (e.amount || 0), 0);

    const splitsToday = userSplitItems
        .filter((s) => s.isToday)
        .reduce((sum, s) => sum + s.myShare, 0);
    const userTodaySpend = Math.round((directToday + splitsToday) * 100) / 100;

    const userMonthSpend = userTotalSpend;
    const totalDirectCount = typeof spendings?.directExpensesCount === 'number'
        ? spendings.directExpensesCount
        : personalDirectExpenses.length;
    const totalUserExpensesCount = totalDirectCount + userSplitItems.length;

    // Upfront bill coverage (if user covered bills upfront for the group, excluding deleted splits)
    const upfrontPaidByActiveUser = allSplits
        .filter((s) => s.status?.toUpperCase() !== 'DELETED' && s.paidBy?.toLowerCase() === activePerson.toLowerCase())
        .reduce((sum, s) => sum + s.totalAmount, 0);

    // Combined activity items for activePerson
    const allPersonalItems = [
        ...personalDirectExpenses.map((e, idx) => ({
            id: `direct-${idx}`,
            description: e.description,
            category: e.category,
            amount: e.amount,
            timestamp: e.timestamp,
            isSplitShare: false,
            badge: 'Personal',
            paidBy: activePerson,
            totalBill: e.amount,
        })),
        ...userSplitItems.map((s) => ({
            id: s.id,
            description: `${s.description} (Your Share)`,
            category: s.category,
            amount: s.myShare,
            timestamp: s.timestamp,
            isSplitShare: true,
            badge: 'Split Share',
            paidBy: s.paidBy,
            totalBill: s.totalAmount,
        })),
    ].sort((a, b) => {
        const timeA = parseCustomDate(a.timestamp)?.getTime() || 0;
        const timeB = parseCustomDate(b.timestamp)?.getTime() || 0;
        return timeB - timeA;
    });

    // Recent 10 items for the home overview dashboard
    const combinedRecentItems = allPersonalItems.slice(0, 10);

    // Calculate pairwise-netted personal settlements across active splits
    const pairwiseBalances = computePersonalPairwiseBalances(
        activeSplits,
        activePerson,
        peopleDetails
    );
    const {
        receivables: groupedOwedToMeList,
        payables: groupedOwedList,
        mutualZeroOffsets,
        totalOwedToYou,
        totalYouOwe,
        netBalance,
        totalOffsetAmount,
    } = pairwiseBalances;

    const handleScannedCreditorQr = (parsed: ParsedUpiQr) => {
        setShowQrScanner(false);
        const normalizedScannedUpi = parsed.upiId.trim().toLowerCase();

        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(parsed.upiId).catch(() => {});
        }

        const directoryMatch = peopleDetails.find(
            (p) => p.upiId?.trim().toLowerCase() === normalizedScannedUpi
        );

        const matchedGroup =
            groupedOwedList.find((g) => g.toUpiId?.trim().toLowerCase() === normalizedScannedUpi) ||
            (directoryMatch
                ? groupedOwedList.find(
                      (g) => g.to.toLowerCase() === directoryMatch.name.toLowerCase()
                  )
                : undefined) ||
            (parsed.payeeName
                ? groupedOwedList.find((g) =>
                      parsed.payeeName!.toLowerCase().includes(g.to.toLowerCase())
                  )
                : undefined);

        if (matchedGroup) {
            const isMulti = matchedGroup.allSplits.length > 1;
            setPaymentSettlement({
                to: matchedGroup.to,
                from: activePerson,
                splitId: isMulti ? undefined : matchedGroup.youOweSplits[0]?.splitId,
                splitIds: isMulti ? matchedGroup.allSplits.map((s) => s.splitId) : undefined,
                amount: parsed.amount || matchedGroup.netAmount,
                toUpiId: parsed.upiId,
                description: matchedGroup.hasMutualOffset
                    ? `Net after ₹${matchedGroup.offsetAmount.toLocaleString('en-IN')} offset (${matchedGroup.allSplits.length} splits)`
                    : isMulti
                      ? `Consolidated payoff (${matchedGroup.allSplits.length} splits)`
                      : matchedGroup.youOweSplits[0]?.description || 'Split due',
            });
            showToast(`Matched pending due to ${matchedGroup.to} • Copied UPI ID`, 'qr_code_scanner');
            return;
        }

        setPaymentSettlement({
            to: directoryMatch?.name || parsed.payeeName || parsed.upiId,
            from: activePerson,
            amount: parsed.amount || 0,
            toUpiId: parsed.upiId,
            description: parsed.note || 'Scanned UPI QR',
        });
        showToast(`Scanned & copied UPI ID: ${parsed.upiId}`, 'qr_code_scanner');
    };

    const resolveSplitId = (splitId: string): string => {
        if (!splitId.startsWith('offline_')) return splitId;
        const currentSplit = allSplits.find((s) => s.splitId === splitId);
        if (currentSplit) {
            const matchedServerSplit = allSplits.find(
                (s) =>
                    !s.splitId.startsWith('offline_') &&
                    s.description === currentSplit.description &&
                    s.totalAmount === currentSplit.totalAmount &&
                    s.paidBy.toLowerCase() === currentSplit.paidBy.toLowerCase()
            );
            if (matchedServerSplit) {
                return matchedServerSplit.splitId;
            }
        }
        return splitId;
    };

    const handleSettle = async (splitId: string, fromPerson: string, toPerson: string) => {
        const targetSplitId = resolveSplitId(splitId);
        const key = `${splitId}_${fromPerson}`;
        setSettlingKey(key);
        try {
            await settleMutation.mutateAsync({
                splitId: targetSplitId,
                from: fromPerson,
                to: toPerson,
                confirmedBy: activePerson,
            });
            triggerHaptic('success');
            showToast(`Confirmed receipt of payment from ${fromPerson}!`, 'check_circle');
        } catch (err: unknown) {
            triggerHaptic('warning');
            showToast(`Failed to settle: ${String(err)}`, 'error');
        } finally {
            setSettlingKey(null);
        }
    };

    const handleSettleSettlementRefs = async (
        refs: PairwiseSettlementRef[],
        lockKey: string,
        successMessage: string
    ) => {
        setSettlingKey(lockKey);
        try {
            await Promise.all(
                refs.map((ref) =>
                    settleMutation.mutateAsync({
                        splitId: resolveSplitId(ref.splitId),
                        from: ref.from,
                        to: ref.to,
                        confirmedBy: activePerson,
                    })
                )
            );
            triggerHaptic('success');
            showToast(successMessage, 'check_circle');
        } catch (err: unknown) {
            triggerHaptic('warning');
            showToast(`Failed to settle: ${String(err)}`, 'error');
        } finally {
            setSettlingKey(null);
        }
    };

    const handleRemindDebtor = async ({
        key,
        splitIds,
        fromPerson,
        toPerson,
        consolidatedAmount,
        consolidatedCount,
    }: {
        key: string;
        splitIds: string[];
        fromPerson: string;
        toPerson: string;
        consolidatedAmount?: number;
        consolidatedCount?: number;
    }) => {
        if (remindingKey === key) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            triggerHaptic('warning');
            showToast('Internet connection required to send reminders.', 'cloud_off');
            return;
        }

        const resolvedIds = splitIds
            .map((id) => resolveSplitId(id))
            .filter((id) => !id.startsWith('offline_'));

        if (resolvedIds.length === 0) {
            triggerHaptic('warning');
            showToast('Split is still syncing offline. Retry in a moment.', 'hourglass_top');
            return;
        }

        setRemindingKey(key);
        try {
            const res = await remindSplitDebtorApi({
                splitId: resolvedIds[0],
                from: fromPerson,
                to: toPerson,
                requestedBy: activePerson,
                ...(consolidatedCount && consolidatedCount > 1
                    ? { consolidatedAmount, consolidatedCount }
                    : {}),
            });
            if (res.delivered > 0) {
                triggerHaptic('success');
                showToast(res.message, 'notifications_active');
            } else {
                triggerHaptic('light');
                showToast(res.message, 'notifications_off');
            }
        } catch (err: unknown) {
            triggerHaptic('warning');
            if (err instanceof ApiError) {
                showToast(err.message, err.status === 429 ? 'schedule' : 'error');
            } else {
                showToast('Failed to send payment reminder.', 'error');
            }
        } finally {
            setRemindingKey(null);
        }
    };

    const pushSupported = isPushSupported();
    const iosNeedsInstall = isIosSafariNotStandalone();
    const permissionState = getNotificationPermissionState();
    const showPushOptInCard =
        isDeviceClaimed &&
        !isPushPromptDismissedState &&
        !pushEnabledLocally &&
        !isPushPausedLocally() &&
        Boolean(pushConfig?.configured) &&
        (iosNeedsInstall ||
            (pushSupported &&
                permissionState === 'default' &&
                !pushStatus?.subscribed));

    const handleEnableDashboardPush = async () => {
        if (isEnablingPush) return;
        if (iosNeedsInstall) {
            setShowIosPushGuide((prev) => !prev);
            return;
        }
        triggerHaptic('light');
        setIsEnablingPush(true);
        try {
            const res = await enablePushNotifications({
                person: claimedPerson,
                config: pushConfig,
            });
            if (res.ok) {
                setPushEnabledLocally(true);
                triggerHaptic('success');
                await queryClient.invalidateQueries({ queryKey: queryKeys.pushStatus() });
                showToast(res.message || 'Push alerts enabled!', 'notifications_active');
            } else {
                triggerHaptic('warning');
                showToast(res.message || 'Could not enable push alerts', 'notifications_off');
            }
        } finally {
            setIsEnablingPush(false);
        }
    };

    const isDataLoading = isSpendingsLoading || isSplitsLoading;

    return (
        <div className="flex flex-col w-full pb-8 space-y-5">
            {/* Greeting Header & Group Context */}
            <div className="flex items-center justify-between pt-1">
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                        <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline">
                            Hi {activePerson}
                        </h1>
                        <span className="text-xl select-none transform transition-transform hover:rotate-12 cursor-pointer">
                            👋
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <p className="text-xs text-on-surface-variant truncate font-medium">
                            {tripInfo?.title || 'Trip'} • Shared Tracker
                        </p>
                    </div>
                </div>

                {/* Net Standing Pill */}
                <div
                    className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-2xs shrink-0 border ${netBalance > 0
                            ? 'bg-primary-fixed/60 border-primary/20 text-on-primary-fixed'
                            : netBalance < 0
                                ? 'bg-error-container/40 border-error/30 text-error'
                                : 'bg-surface-container border-outline-variant/30 text-on-surface-variant'
                        }`}
                    title={
                        netBalance > 0
                            ? `You are to receive ₹${netBalance.toLocaleString('en-IN')} net after all settlements`
                            : netBalance < 0
                                ? `You owe ₹${Math.abs(netBalance).toLocaleString('en-IN')} net after all settlements`
                                : 'All your settlements are cleared'
                    }
                >
                    <span className="material-symbols-outlined text-[16px]">
                        {netBalance > 0 ? 'trending_up' : netBalance < 0 ? 'trending_down' : 'check_circle'}
                    </span>
                    <span className="text-xs font-bold font-mono">
                        {netBalance > 0
                            ? `+₹${netBalance.toLocaleString('en-IN')} to receive`
                            : netBalance < 0
                                ? `-₹${Math.abs(netBalance).toLocaleString('en-IN')} to pay`
                                : '₹0 all settled'}
                    </span>
                </div>
            </div>

            {/* Settlement Balance Cards: Expect from others vs You owe */}
            <div className="grid grid-cols-2 gap-3">
                {/* Money to Receive / Expect from others */}
                <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/30 flex flex-col justify-between shadow-xs relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider font-mono">
                            EXPECT FROM OTHERS
                        </span>
                        <div className="w-6 h-6 rounded-full bg-primary-fixed flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-[15px]">
                                arrow_downward
                            </span>
                        </div>
                    </div>
                    <div>
                        <p className="text-xl font-bold text-primary tracking-tight font-mono">
                            ₹{totalOwedToYou.toLocaleString('en-IN')}
                        </p>
                        <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                            {groupedOwedToMeList.length > 0
                                ? `From ${groupedOwedToMeList.length} ${groupedOwedToMeList.length === 1 ? 'person' : 'people'}`
                                : totalOffsetAmount > 0
                                  ? `Nothing due (₹${totalOffsetAmount.toLocaleString('en-IN')} offset)`
                                  : 'Nothing pending'}
                        </p>
                    </div>
                </div>

                {/* Money You Owe */}
                <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/30 flex flex-col justify-between shadow-xs relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider font-mono">
                            YOU OWE
                        </span>
                        <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center ${totalYouOwe > 0
                                    ? 'bg-error-container text-error'
                                    : 'bg-surface-container text-on-surface-variant'
                                }`}
                        >
                            <span className="material-symbols-outlined text-[15px]">
                                arrow_upward
                            </span>
                        </div>
                    </div>
                    <div>
                        <p
                            className={`text-xl font-bold tracking-tight font-mono ${totalYouOwe > 0 ? 'text-error' : 'text-on-surface'
                                }`}
                        >
                            ₹{totalYouOwe.toLocaleString('en-IN')}
                        </p>
                        <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                            {groupedOwedList.length > 0
                                ? `To ${groupedOwedList.length} ${groupedOwedList.length === 1 ? 'person' : 'people'}`
                                : totalOffsetAmount > 0
                                  ? `All cleared (₹${totalOffsetAmount.toLocaleString('en-IN')} offset)`
                                  : 'All cleared'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Spendings Bento Summary Cards for Active User */}
            <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                    {/* Total Spend by Active Person */}
                    <div
                        onClick={() => {
                            triggerHaptic('light');
                            setShowSpendHistory(true);
                        }}
                        className="bg-surface-container-lowest p-4 rounded-2xl shadow-xs border border-outline-variant/30 hover:border-primary/40 flex flex-col justify-between relative overflow-hidden cursor-pointer active:scale-[0.98] transition-all group"
                        title="Tap to view month-wise spend breakdown"
                        role="button"
                        tabIndex={0}
                    >
                        <div className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-primary-fixed/20 pointer-events-none group-hover:scale-110 transition-transform" />
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-outline tracking-wider font-mono flex items-center gap-1">
                                <span>YOUR SPEND</span>
                                <span className="material-symbols-outlined text-[12px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward</span>
                            </span>
                            <div className="w-6 h-6 rounded-full bg-primary-fixed flex items-center justify-center text-primary shadow-2xs">
                                <span className="material-symbols-outlined text-[16px]">
                                    wallet
                                </span>
                            </div>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-primary tracking-tight font-mono">
                                {isDataLoading ? '...' : `₹${userTotalSpend.toLocaleString('en-IN')}`}
                            </p>
                            <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                                {totalUserExpensesCount} {totalUserExpensesCount === 1 ? 'item' : 'items'} • ₹{splitsTotal.toLocaleString('en-IN')} in splits
                            </p>
                        </div>
                    </div>

                    {/* Today's Spend by Active Person */}
                    <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-xs border border-outline-variant/30 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-secondary-fixed/25 pointer-events-none" />
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-outline tracking-wider font-mono">
                                TODAY ({activePerson})
                            </span>
                            <div className="w-6 h-6 rounded-full bg-secondary-container flex items-center justify-center text-secondary">
                                <span className="material-symbols-outlined text-[16px]">
                                    today
                                </span>
                            </div>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-on-surface tracking-tight font-mono">
                                {isDataLoading ? '...' : `₹${userTodaySpend.toLocaleString('en-IN')}`}
                            </p>
                            <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                                Month: ₹{userMonthSpend.toLocaleString('en-IN')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Upfront bill coverage banner if user paid group bills */}
                {upfrontPaidByActiveUser > 0 && (
                    <div className="bg-surface-container-low/70 px-3.5 py-2 rounded-xl border border-outline-variant/20 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-on-surface-variant">
                            <span className="material-symbols-outlined text-primary text-[16px]">
                                paid
                            </span>
                            <span>Paid upfront on group bills:</span>
                        </div>
                        <span className="font-bold text-on-surface font-mono">
                            ₹{upfrontPaidByActiveUser.toLocaleString('en-IN')}
                        </span>
                    </div>
                )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2.5">
                <button
                    type="button"
                    onClick={() => setActiveTab('add')}
                    className="flex-1 bg-primary text-on-primary h-12 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer font-semibold text-sm hover:bg-primary-container"
                >
                    <span className="material-symbols-outlined text-[20px]">
                        add_circle
                    </span>
                    <span>Add Expense</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('splits')}
                    className="flex-1 bg-surface-container-high text-on-surface h-12 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer font-semibold text-sm hover:bg-surface-container border border-outline-variant/30"
                >
                    <span className="material-symbols-outlined text-secondary text-[20px]">
                        call_split
                    </span>
                    <span>View Splits</span>
                </button>
            </div>

            {/* Camera QR Scanner Quick Action */}
            <button
                type="button"
                onClick={() => {
                    triggerHaptic('light');
                    setShowQrScanner(true);
                }}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-primary/5 border border-primary/25 hover:border-primary/45 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex items-center justify-between gap-2.5 active:scale-[0.99] transition-[border-color,transform] cursor-pointer group"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                    </div>
                    <div className="text-left min-w-0">
                        <span className="text-xs font-bold text-on-surface block truncate">
                            Scan Creditor&apos;s UPI QR
                        </span>
                        <span className="text-[11px] text-on-surface-variant block truncate">
                            Read friend&apos;s QR code via camera or gallery &amp; settle dues
                        </span>
                    </div>
                </div>
                <span className="material-symbols-outlined text-[18px] text-primary group-hover:translate-x-0.5 transition-transform shrink-0">
                    photo_camera
                </span>
            </button>

            {/* Quick Link to Dedicated /analytics Route */}
            <button
                type="button"
                onClick={() => {
                    triggerHaptic('light');
                    setActiveTab('analytics');
                }}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-card border border-border-subtle hover:border-primary/40 shadow-[0_1px_3px_rgba(15,23,42,0.05)] flex items-center justify-between gap-2.5 active:scale-[0.99] transition-[border-color,transform] cursor-pointer group"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-status-settled-bg text-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">analytics</span>
                    </div>
                    <div className="text-left min-w-0">
                        <span className="text-xs font-bold text-on-surface block truncate">
                            See Where Your Money Goes
                        </span>
                        <span className="text-[11px] text-on-surface-variant block truncate">
                            Category donut, daily burn &amp; monthly spend insights
                        </span>
                    </div>
                </div>
                <span className="material-symbols-outlined text-[18px] text-primary group-hover:translate-x-0.5 transition-transform shrink-0">
                    arrow_forward
                </span>
            </button>

            {/* Compact Web Push Opt-In Banner */}
            {showPushOptInCard && (
                <div className="bg-surface-card border border-border-subtle rounded-2xl p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] space-y-2">
                    <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[18px]">
                                    notifications_active
                                </span>
                            </div>
                            <div className="min-w-0">
                                <span className="text-xs font-bold text-on-surface block truncate">
                                    Enable Split &amp; Settle-Up Alerts
                                </span>
                                <span className="text-[11px] text-on-surface-variant block truncate">
                                    {iosNeedsInstall
                                        ? 'Add to Home Screen on iOS to receive alerts'
                                        : 'Get notified on new splits, reminders & confirmations'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                type="button"
                                disabled={isEnablingPush}
                                onClick={() => void handleEnableDashboardPush()}
                                className="h-8 px-3 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-dark transition-colors cursor-pointer disabled:opacity-50"
                            >
                                {isEnablingPush
                                    ? '...'
                                    : iosNeedsInstall
                                    ? showIosPushGuide
                                        ? 'Hide'
                                        : 'How?'
                                    : 'Enable'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    dismissPushPrompt();
                                    setIsPushPromptDismissedState(true);
                                }}
                                className="w-7 h-7 rounded-lg text-on-surface-variant hover:bg-surface-container flex items-center justify-center cursor-pointer transition-colors"
                                aria-label="Dismiss push notifications prompt"
                                title="Dismiss"
                            >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                        </div>
                    </div>

                    {iosNeedsInstall && showIosPushGuide && (
                        <p className="text-[11px] text-on-surface-variant bg-surface-container-low rounded-xl px-3 py-2 border border-outline-variant/20">
                            Tap <strong className="text-on-surface">Share → Add to Home Screen</strong> in Safari, open SplitNest from your Home Screen, then tap <strong className="text-on-surface">Enable</strong> in Profile or this card.
                        </p>
                    )}
                </div>
            )}

            {/* Pending Settlements for Active Person (Pairwise Netted) */}
            {(groupedOwedList.length > 0 || groupedOwedToMeList.length > 0 || mutualZeroOffsets.length > 0) && (
                <div className="space-y-2.5">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-base font-bold text-on-surface font-headline">
                            {groupedOwedList.length + groupedOwedToMeList.length > 0
                                ? 'Action Required on Splits'
                                : 'Mutual Split Offsets'}
                        </h2>
                        <span className="text-xs text-primary font-semibold">
                            {groupedOwedList.length + groupedOwedToMeList.length > 0
                                ? `${groupedOwedList.length + groupedOwedToMeList.length} ${
                                      groupedOwedList.length + groupedOwedToMeList.length === 1
                                          ? 'Balance'
                                          : 'Balances'
                                  }`
                                : `${mutualZeroOffsets.length} Cancelled ₹0`}
                        </span>
                    </div>

                    {/* What you owe (Pairwise Netted) */}
                    {groupedOwedList.map((group, idx) => {
                        const isMulti = group.allSplits.length > 1;
                        const isExpanded = !!expandedOwed[group.to];
                        const netSubtitle = group.hasMutualOffset
                            ? `Net after ₹${group.offsetAmount.toLocaleString('en-IN')} offset (₹${group.grossIOwe.toLocaleString('en-IN')} - ₹${group.grossOwedToMe.toLocaleString('en-IN')})`
                            : group.youOweSplits.length > 1
                              ? group.youOweSplits.map((s) => s.description).join(', ')
                              : `For ${group.youOweSplits[0]?.description || 'Split due'}`;

                        return (
                            <div
                                key={`owe-group-${group.to}-${idx}`}
                                className="bg-surface-container-lowest p-3.5 rounded-2xl shadow-xs border border-outline-variant/30 space-y-3"
                            >
                                {/* Top Details Row: Avatar + Name + Subtitle (Left), Amount + Chevron (Right) */}
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Avatar name={group.to} size="md" />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h4 className="font-bold text-sm text-on-surface truncate">
                                                    Pay {group.to}
                                                </h4>
                                                {isMulti && (
                                                    <span className="px-2 py-0.5 rounded-full bg-secondary-fixed/60 text-on-secondary-fixed text-[10px] font-bold shrink-0">
                                                        {group.allSplits.length} splits
                                                    </span>
                                                )}
                                                {group.hasMutualOffset && (
                                                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                                                        ₹{group.offsetAmount.toLocaleString('en-IN')} offset
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-on-surface-variant truncate mt-0.5">
                                                {netSubtitle}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="font-bold text-base sm:text-lg text-error font-mono tracking-tight">
                                            ₹{group.netAmount.toLocaleString('en-IN')}
                                        </span>
                                        {isMulti && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setExpandedOwed((prev) => ({
                                                        ...prev,
                                                        [group.to]: !prev[group.to],
                                                    }))
                                                }
                                                className="w-7 h-7 rounded-lg text-on-surface-variant hover:bg-surface-container-high flex items-center justify-center transition-colors cursor-pointer"
                                                title={isExpanded ? 'Collapse breakdown' : 'Expand breakdown'}
                                            >
                                                <span className="material-symbols-outlined text-[20px]">
                                                    {isExpanded ? 'expand_less' : 'expand_more'}
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Consolidated Breakdown Sub-list (if expanded) */}
                                {isMulti && isExpanded && (
                                    <div className="pt-2 border-t border-outline-variant/15 space-y-1.5">
                                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block px-1">
                                            {group.hasMutualOffset
                                                ? 'Pairwise Netting Breakdown'
                                                : 'Included Splits Breakdown'}
                                        </span>
                                        {group.youOweSplits.map((s, subIdx) => (
                                            <div
                                                key={`owed-sub-${s.splitId}-${subIdx}`}
                                                className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-surface-container-low border border-outline-variant/15"
                                            >
                                                <span className="text-on-surface truncate font-medium pr-2">
                                                    {s.description}
                                                </span>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="font-mono text-error font-bold">
                                                        {group.hasMutualOffset ? '+' : ''}₹{s.amount.toLocaleString('en-IN')}
                                                    </span>
                                                    {!group.hasMutualOffset && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setPaymentSettlement({
                                                                    to: group.to,
                                                                    from: activePerson,
                                                                    splitId: s.splitId,
                                                                    amount: s.amount,
                                                                    toUpiId: s.toUpiId ?? group.toUpiId,
                                                                    upiIntent: s.upiIntent,
                                                                    description: s.description,
                                                                });
                                                            }}
                                                            className="px-2.5 py-1 rounded-lg bg-surface-container-high text-primary hover:bg-primary/10 text-[11px] font-bold cursor-pointer transition-colors"
                                                        >
                                                            Pay
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {group.counterSplits.map((s, subIdx) => (
                                            <div
                                                key={`owed-offset-sub-${s.splitId}-${subIdx}`}
                                                className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-status-settled-bg/40 border border-primary/20"
                                            >
                                                <span className="text-on-surface truncate font-medium pr-2">
                                                    Offset: {s.description} ({s.from} owes you)
                                                </span>
                                                <span className="font-mono text-primary font-bold shrink-0">
                                                    -₹{s.amount.toLocaleString('en-IN')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Action Row / Footer */}
                                <div className="pt-2 border-t border-outline-variant/15 flex items-center justify-between gap-2">
                                    {group.toUpiId ? (
                                        <span className="text-[11px] text-on-surface-variant font-mono truncate">
                                            UPI: {group.toUpiId}
                                        </span>
                                    ) : (
                                        <span className="text-[11px] text-on-surface-variant/80 truncate">
                                            No UPI saved — scan {group.to}&apos;s QR
                                        </span>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPaymentSettlement({
                                                to: group.to,
                                                from: activePerson,
                                                splitId: isMulti ? undefined : group.youOweSplits[0]?.splitId,
                                                splitIds: isMulti ? group.allSplits.map((s) => s.splitId) : undefined,
                                                amount: group.netAmount,
                                                toUpiId: group.toUpiId,
                                                upiIntent: group.upiIntent,
                                                description: group.hasMutualOffset
                                                    ? `Net after ₹${group.offsetAmount.toLocaleString('en-IN')} offset (${group.allSplits.length} splits)`
                                                    : isMulti
                                                      ? `Consolidated payoff (${group.allSplits.length} splits)`
                                                      : group.youOweSplits[0]?.description || 'Split due',
                                            });
                                        }}
                                        className="h-9 px-3.5 rounded-xl bg-primary text-on-primary text-xs font-semibold flex items-center gap-1.5 shadow-xs hover:bg-primary/90 transition-colors cursor-pointer active:scale-[0.99] shrink-0"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">
                                            {group.upiIntent || group.toUpiId ? 'qr_code_2' : 'qr_code_scanner'}
                                        </span>
                                        <span>
                                            {group.upiIntent || group.toUpiId
                                                ? group.hasMutualOffset
                                                    ? 'Pay Net QR'
                                                    : isMulti
                                                      ? 'Pay All QR'
                                                      : 'Pay via QR'
                                                : 'Scan & Pay'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {/* Batch Share Named QR Cards to WhatsApp Group */}
                    {groupedOwedToMeList.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic('medium');
                                setGroupCollectData({
                                    title: 'Share Collect QRs to WhatsApp',
                                    subtitle: tripInfo?.title
                                        ? `${tripInfo.title} • Pay ${activePerson}`
                                        : `Pay ${activePerson}`,
                                    debtors: groupedOwedToMeList.map((g) => ({
                                        debtorName: g.from,
                                        amount: g.netAmount,
                                        description: g.hasMutualOffset
                                            ? `Net after ₹${g.offsetAmount.toLocaleString('en-IN')} offset (${g.allSplits.length} splits)`
                                            : g.owedToMeSplits.length > 1
                                              ? `${g.owedToMeSplits.length} splits (${g.owedToMeSplits.map((s) => s.description).join(', ')})`
                                              : g.owedToMeSplits[0]?.description || 'Split share',
                                        splitCount: g.allSplits.length,
                                    })),
                                });
                            }}
                            className="w-full px-3.5 py-2.5 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/35 hover:border-[#25D366]/60 flex items-center justify-between gap-2.5 active:scale-[0.99] transition-colors cursor-pointer group"
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-[#25D366]/20 text-[#15803d] flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                                </div>
                                <div className="text-left min-w-0">
                                    <span className="text-xs font-bold text-on-surface block truncate">
                                        Share {groupedOwedToMeList.length} Named Collect{' '}
                                        {groupedOwedToMeList.length === 1 ? 'QR' : 'QRs'} to WhatsApp
                                    </span>
                                    <span className="text-[11px] text-on-surface-variant block truncate">
                                        Send individual UPI QR cards ({groupedOwedToMeList.map((g) => g.from).join(', ')}) in group chat
                                    </span>
                                </div>
                            </div>
                            <span className="material-symbols-outlined text-[18px] text-[#15803d] shrink-0">
                                ios_share
                            </span>
                        </button>
                    )}

                    {/* What others owe you (Creditor: Pairwise Netted) */}
                    {groupedOwedToMeList.map((group, idx) => {
                        const isMulti = group.allSplits.length > 1;
                        const isExpanded = !!expandedOwedToMe[group.from];
                        const netSubtitle = group.hasMutualOffset
                            ? `Net after ₹${group.offsetAmount.toLocaleString('en-IN')} offset (₹${group.grossOwedToMe.toLocaleString('en-IN')} - ₹${group.grossIOwe.toLocaleString('en-IN')})`
                            : group.owedToMeSplits.length > 1
                              ? group.owedToMeSplits.map((s) => s.description).join(', ')
                              : `For ${group.owedToMeSplits[0]?.description || 'Split due'}`;
                        const resolvedRefs = group.allSplits.map((s) => ({
                            splitId: resolveSplitId(s.splitId),
                            from: s.from,
                            to: s.to,
                        }));

                        return (
                            <div
                                key={`owed-to-me-group-${group.from}-${idx}`}
                                className="bg-surface-container-lowest p-3.5 rounded-2xl shadow-xs border border-outline-variant/30 space-y-3"
                            >
                                {/* Top Details Row: Avatar + Name + Subtitle (Left), Amount + Chevron (Right) */}
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Avatar name={group.from} size="md" />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h4 className="font-bold text-sm text-on-surface truncate">
                                                    {group.from} owes you
                                                </h4>
                                                {isMulti && (
                                                    <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed text-[10px] font-bold shrink-0">
                                                        {group.allSplits.length} splits
                                                    </span>
                                                )}
                                                {group.hasMutualOffset && (
                                                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                                                        ₹{group.offsetAmount.toLocaleString('en-IN')} offset
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-on-surface-variant truncate mt-0.5">
                                                {netSubtitle}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="font-bold text-base sm:text-lg text-primary font-mono tracking-tight">
                                            ₹{group.netAmount.toLocaleString('en-IN')}
                                        </span>
                                        {isMulti && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setExpandedOwedToMe((prev) => ({
                                                        ...prev,
                                                        [group.from]: !prev[group.from],
                                                    }))
                                                }
                                                className="w-7 h-7 rounded-lg text-on-surface-variant hover:bg-surface-container-high flex items-center justify-center transition-colors cursor-pointer"
                                                title={isExpanded ? 'Collapse breakdown' : 'Expand breakdown'}
                                            >
                                                <span className="material-symbols-outlined text-[20px]">
                                                    {isExpanded ? 'expand_less' : 'expand_more'}
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Consolidated Breakdown Sub-list (if expanded) */}
                                {isMulti && isExpanded && (
                                    <div className="pt-2 border-t border-outline-variant/15 space-y-1.5">
                                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block px-1">
                                            {group.hasMutualOffset
                                                ? 'Pairwise Netting Breakdown'
                                                : 'Included Splits Breakdown'}
                                        </span>
                                        {group.owedToMeSplits.map((s, subIdx) => (
                                            <div
                                                key={`owed-to-me-sub-${s.splitId}-${subIdx}`}
                                                className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-surface-container-low border border-outline-variant/15"
                                            >
                                                <span className="text-on-surface truncate font-medium pr-2">
                                                    {s.description}
                                                </span>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <span className="font-mono text-primary font-bold">
                                                        {group.hasMutualOffset ? '+' : ''}₹{s.amount.toLocaleString('en-IN')}
                                                    </span>
                                                    {!group.hasMutualOffset && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                disabled={
                                                                    remindingKey === `${s.splitId}_${group.from}` ||
                                                                    remindingKey === `group_${group.from}`
                                                                }
                                                                onClick={() =>
                                                                    void handleRemindDebtor({
                                                                        key: `${s.splitId}_${group.from}`,
                                                                        splitIds: [s.splitId],
                                                                        fromPerson: group.from,
                                                                        toPerson: activePerson,
                                                                    })
                                                                }
                                                                className="flex items-center p-1 rounded-md bg-status-awaiting-bg/80 text-status-awaiting-text hover:bg-status-awaiting-bg transition-colors cursor-pointer disabled:opacity-50"
                                                                title={`Send payment reminder to ${group.from} for ${s.description}`}
                                                                aria-label={`Remind ${group.from} for ${s.description}`}
                                                            >
                                                                <span className="material-symbols-outlined text-[15px]">
                                                                    {remindingKey === `${s.splitId}_${group.from}`
                                                                        ? 'hourglass_top'
                                                                        : 'notifications_active'}
                                                                </span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setCollectSettlement({
                                                                        debtorName: group.from,
                                                                        amount: s.amount,
                                                                        splitId: s.splitId,
                                                                        description: s.description,
                                                                    });
                                                                }}
                                                                className="flex items-center p-1 rounded-md bg-surface-container-high text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                                                title="Show QR for this item"
                                                            >
                                                                <span className="material-symbols-outlined text-[15px]">
                                                                    qr_code_2
                                                                </span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={settlingKey === `${s.splitId}_${group.from}` || settlingKey === `multi_${group.from}`}
                                                                onClick={() =>
                                                                    handleSettle(s.splitId, group.from, activePerson)
                                                                }
                                                                className="px-2 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed hover:bg-primary hover:text-on-primary text-[11px] font-bold cursor-pointer disabled:opacity-50 transition-colors"
                                                            >
                                                                Confirm
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {group.counterSplits.map((s, subIdx) => (
                                            <div
                                                key={`owed-to-me-offset-sub-${s.splitId}-${subIdx}`}
                                                className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-error-container/25 border border-error/20"
                                            >
                                                <span className="text-on-surface truncate font-medium pr-2">
                                                    Offset: {s.description} (you owe {s.to})
                                                </span>
                                                <span className="font-mono text-error font-bold shrink-0">
                                                    -₹{s.amount.toLocaleString('en-IN')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Actions Row: Show QR, Remind & Confirm */}
                                <div className="pt-2 border-t border-outline-variant/15 flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCollectSettlement({
                                                debtorName: group.from,
                                                amount: group.netAmount,
                                                splitId: isMulti ? undefined : resolvedRefs[0]?.splitId,
                                                splitIds: isMulti ? resolvedRefs.map((r) => r.splitId) : undefined,
                                                settlementRefs: resolvedRefs,
                                                description: group.hasMutualOffset
                                                    ? `Net after ₹${group.offsetAmount.toLocaleString('en-IN')} offset (${group.allSplits.length} splits)`
                                                    : isMulti
                                                      ? `${group.allSplits.length} splits combined`
                                                      : group.owedToMeSplits[0]?.description || 'Split due',
                                            });
                                        }}
                                        className="flex-1 h-9 px-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold flex items-center justify-center gap-1 transition-colors border border-outline-variant/30 cursor-pointer active:scale-[0.99] whitespace-nowrap"
                                        title={`Show QR code to collect ₹${group.netAmount} from ${group.from}`}
                                    >
                                        <span className="material-symbols-outlined text-[17px] text-primary">
                                            qr_code_2
                                        </span>
                                        <span>Show QR</span>
                                    </button>

                                    <button
                                        type="button"
                                        disabled={remindingKey === `group_${group.from}`}
                                        onClick={() =>
                                            void handleRemindDebtor({
                                                key: `group_${group.from}`,
                                                splitIds: group.owedToMeSplits.map((s) => s.splitId),
                                                fromPerson: group.from,
                                                toPerson: activePerson,
                                                consolidatedAmount: isMulti ? group.netAmount : undefined,
                                                consolidatedCount: isMulti ? group.allSplits.length : undefined,
                                            })
                                        }
                                        className="h-9 px-2.5 rounded-xl bg-status-awaiting-bg/85 hover:bg-status-awaiting-bg text-status-awaiting-text text-xs font-bold flex items-center justify-center gap-1 transition-colors border border-status-awaiting-text/25 cursor-pointer disabled:opacity-50 active:scale-[0.99] shrink-0 whitespace-nowrap"
                                        title={`Send push payment reminder to ${group.from}`}
                                        aria-label={`Remind ${group.from}`}
                                    >
                                        <span className="material-symbols-outlined text-[16px]">
                                            {remindingKey === `group_${group.from}`
                                                ? 'hourglass_top'
                                                : 'notifications_active'}
                                        </span>
                                        <span>
                                            {remindingKey === `group_${group.from}` ? 'Sending' : 'Remind'}
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            settlingKey === `multi_${group.from}` ||
                                            settlingKey === `offset_${group.from}` ||
                                            (group.allSplits.length === 1 &&
                                                settlingKey === `${group.allSplits[0].splitId}_${group.from}`)
                                        }
                                        onClick={() =>
                                            group.allSplits.length > 1
                                                ? void handleSettleSettlementRefs(
                                                      group.allSplits,
                                                      `multi_${group.from}`,
                                                      `Confirmed net ₹${group.netAmount.toLocaleString('en-IN')} settlement with ${group.from}!`
                                                  )
                                                : void handleSettle(
                                                      group.allSplits[0].splitId,
                                                      group.from,
                                                      activePerson
                                                  )
                                        }
                                        className="flex-1 h-9 px-2.5 rounded-xl bg-primary-fixed hover:bg-primary text-on-primary-fixed hover:text-on-primary text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-2xs disabled:opacity-50 cursor-pointer active:scale-[0.99] whitespace-nowrap"
                                        title={`Confirm receipt of ₹${group.netAmount} from ${group.from}`}
                                    >
                                        <span className="material-symbols-outlined text-[16px]">
                                            done_all
                                        </span>
                                        <span>{isMulti ? 'Confirm All' : 'Confirm'}</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {/* Cancelled Mutual Offsets (Zero-Net Pairs, e.g. +50 and -50 = ₹0) */}
                    {mutualZeroOffsets.map((pair) => {
                        const isExpanded = !!expandedOffsets[pair.counterparty];
                        const lockKey = `offset_${pair.counterparty}`;
                        const isClearing = settlingKey === lockKey;

                        return (
                            <div
                                key={`mutual-offset-${pair.counterparty}`}
                                className="bg-status-settled-bg/45 p-3.5 rounded-2xl border border-primary/25 space-y-2.5 shadow-xs"
                            >
                                <div className="flex items-center justify-between gap-2.5">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-[20px]">
                                                swap_horiz
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h4 className="font-bold text-sm text-on-surface truncate">
                                                    {activePerson} ↔ {pair.counterparty}
                                                </h4>
                                                <span className="px-2 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-bold font-mono shrink-0">
                                                    Net ₹0
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                                                ₹{pair.offsetAmount.toLocaleString('en-IN')} cancelled across {pair.allSplits.length} mutual splits
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setExpandedOffsets((prev) => ({
                                                ...prev,
                                                [pair.counterparty]: !prev[pair.counterparty],
                                            }))
                                        }
                                        className="w-7 h-7 rounded-lg text-on-surface-variant hover:bg-primary/10 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                        title={isExpanded ? 'Collapse offset details' : 'View offset splits'}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            {isExpanded ? 'expand_less' : 'expand_more'}
                                        </span>
                                    </button>
                                </div>

                                {isExpanded && (
                                    <div className="pt-2 border-t border-primary/15 space-y-1.5">
                                        {pair.owedToMeSplits.map((s, subIdx) => (
                                            <div
                                                key={`zero-in-${s.splitId}-${subIdx}`}
                                                className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/20"
                                            >
                                                <span className="text-on-surface truncate pr-2">
                                                    {s.from} owes you: <strong>{s.description}</strong>
                                                </span>
                                                <span className="font-mono font-bold text-primary shrink-0">
                                                    +₹{s.amount.toLocaleString('en-IN')}
                                                </span>
                                            </div>
                                        ))}
                                        {pair.youOweSplits.map((s, subIdx) => (
                                            <div
                                                key={`zero-out-${s.splitId}-${subIdx}`}
                                                className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/20"
                                            >
                                                <span className="text-on-surface truncate pr-2">
                                                    You owe {s.to}: <strong>{s.description}</strong>
                                                </span>
                                                <span className="font-mono font-bold text-error shrink-0">
                                                    -₹{s.amount.toLocaleString('en-IN')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="pt-1.5 border-t border-primary/15 flex items-center justify-between gap-2">
                                    <span className="text-[11px] text-status-settled-text font-medium truncate">
                                        Both sides cancel out — no payment needed
                                    </span>
                                    <button
                                        type="button"
                                        disabled={isClearing}
                                        onClick={() =>
                                            void handleSettleSettlementRefs(
                                                pair.allSplits,
                                                lockKey,
                                                `Cleared ${pair.allSplits.length} mutual offset splits with ${pair.counterparty}!`
                                            )
                                        }
                                        className="h-8 px-3 rounded-xl bg-primary text-on-primary text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer shrink-0 active:scale-[0.98]"
                                        title={`Mark all ${pair.allSplits.length} cancelled splits as settled`}
                                    >
                                        <span className="material-symbols-outlined text-[15px]">
                                            {isClearing ? 'hourglass_top' : 'done_all'}
                                        </span>
                                        <span>{isClearing ? 'Clearing...' : 'Clear Offset Splits'}</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Settled Splits History Shortcut when all balances are settled */}
            {!isSplitsLoading &&
                groupedOwedList.length === 0 &&
                groupedOwedToMeList.length === 0 &&
                mutualZeroOffsets.length === 0 &&
                visibleSplits.length > 0 && (
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic('light');
                            setActiveTab('splits');
                        }}
                        className="w-full px-3.5 py-2.5 rounded-2xl bg-status-settled-bg/45 border border-primary/25 hover:border-primary/45 shadow-2xs flex items-center justify-between gap-2.5 active:scale-[0.99] transition-colors cursor-pointer group"
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[18px]">done_all</span>
                            </div>
                            <div className="text-left min-w-0">
                                <span className="text-xs font-bold text-on-surface block truncate">
                                    All Splits Settled
                                </span>
                                <span className="text-[11px] text-on-surface-variant block truncate">
                                    {visibleSplits.length}{' '}
                                    {visibleSplits.length === 1 ? 'split' : 'splits'} saved in split history
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-primary shrink-0">
                            <span>View History</span>
                            <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">
                                arrow_forward
                            </span>
                        </div>
                    </button>
                )}

            {/* Recent Expenses List for Active Person */}
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 px-1">
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base font-bold text-on-surface font-headline truncate">
                            Recent Spendings
                        </h2>
                        <span className="text-[11px] text-on-surface-variant font-mono block truncate">
                            {combinedRecentItems.length} of {allPersonalItems.length}{' '}
                            {allPersonalItems.length === 1 ? 'item' : 'items'} • {activePerson}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic('light');
                            setShowSpendHistory(true);
                        }}
                        className="shrink-0 whitespace-nowrap text-xs font-semibold text-primary hover:text-primary-container active:opacity-70 transition-opacity flex items-center gap-0.5 cursor-pointer py-1 pl-2 -mr-1"
                        title="View all transactions month-wise"
                    >
                        <span>View all</span>
                        <span className="material-symbols-outlined text-[15px] translate-y-[0.5px]">
                            chevron_right
                        </span>
                    </button>
                </div>

                {isDataLoading ? (
                    <div className="bg-surface-container-lowest p-6 rounded-2xl text-center text-xs text-on-surface-variant animate-pulse border border-outline-variant/30">
                        Loading expenses from backend...
                    </div>
                ) : !combinedRecentItems.length ? (
                    <div className="bg-surface-container-lowest p-6 rounded-2xl text-center text-xs text-on-surface-variant border border-outline-variant/30">
                        No expenses or split shares recorded for {activePerson} yet.
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {combinedRecentItems.map((item) => {
                            const catMeta = getCategoryMeta(item.category);
                            const timeInfo = formatPurchaseTime(item.timestamp);
                            const isPaidByMe = item.paidBy?.toLowerCase() === activePerson.toLowerCase();

                            return (
                                <div
                                    key={item.id}
                                    className="bg-surface-container-lowest p-3.5 rounded-2xl shadow-2xs border border-outline-variant/30 hover:border-outline-variant/50 transition-all flex flex-col gap-2.5"
                                >
                                    {/* Top Row: Category Icon, Description, Category & Badge, and Amount */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 min-w-0">
                                            {/* Category Icon with Category-Tuned Color */}
                                            <div
                                                className={`w-10 h-10 rounded-xl ${catMeta.bgClass} flex items-center justify-center shrink-0 mt-0.5`}
                                            >
                                                <span
                                                    className={`material-symbols-outlined text-[20px] ${catMeta.textClass}`}
                                                >
                                                    {catMeta.icon}
                                                </span>
                                            </div>

                                            {/* Description & Category / Type Badges */}
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-sm text-on-surface truncate leading-snug">
                                                    {item.description}
                                                </h4>
                                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                    <span className="text-[11px] font-semibold text-on-surface-variant">
                                                        {item.category}
                                                    </span>
                                                    <span className="opacity-40 text-[10px]">•</span>
                                                    <span
                                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                                            item.isSplitShare
                                                                ? 'bg-primary-fixed text-on-primary-fixed'
                                                                : 'bg-surface-container-high text-on-surface-variant'
                                                        }`}
                                                    >
                                                        {item.badge}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Amount & Total Bill Reference */}
                                        <div className="text-right shrink-0">
                                            <p className="font-bold text-base font-mono text-on-surface tracking-tight">
                                                ₹{item.amount.toLocaleString('en-IN')}
                                            </p>
                                            {item.isSplitShare && item.totalBill && (
                                                <span className="text-[10px] text-on-surface-variant font-mono block mt-0.5">
                                                    of ₹{item.totalBill.toLocaleString('en-IN')} bill
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bottom Metadata Row: Payer Context & Prominent Time of Purchase */}
                                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/15 text-xs text-on-surface-variant">
                                        {/* Payer Context */}
                                        <div className="flex items-center gap-1.5 min-w-0 text-[11px]">
                                            <span className="material-symbols-outlined text-[14px] text-primary/70 shrink-0">
                                                {item.isSplitShare ? 'group' : 'person'}
                                            </span>
                                            <span className="truncate">
                                                {item.isSplitShare && item.paidBy
                                                    ? isPaidByMe
                                                        ? 'Paid by you for group'
                                                        : `Paid by ${item.paidBy}`
                                                    : 'Personal spend'}
                                            </span>
                                        </div>

                                        {/* Time of Purchase Badge */}
                                        {timeInfo.full && (
                                            <div
                                                className="flex items-center gap-1 text-[11px] font-mono font-semibold text-on-surface bg-surface-container/70 px-2 py-0.5 rounded-lg border border-outline-variant/25 shrink-0 shadow-2xs"
                                                title={`Recorded at: ${timeInfo.raw}`}
                                            >
                                                <span className="material-symbols-outlined text-[13px] text-primary">
                                                    schedule
                                                </span>
                                                <span>{timeInfo.full}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {allPersonalItems.length > 10 && (
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic('light');
                                    setShowSpendHistory(true);
                                }}
                                className="w-full py-2.5 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-outline-variant/30 active:scale-[0.99] shadow-2xs"
                            >
                                <span className="material-symbols-outlined text-[17px]">calendar_month</span>
                                <span>View all {allPersonalItems.length} transactions across months</span>
                                <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
            {/* Payment App / UPI Intent Modal */}
            <PaymentModal
                isOpen={!!paymentSettlement}
                onClose={() => setPaymentSettlement(null)}
                settlement={paymentSettlement}
            />

            {/* Creditor's Collect via QR Modal */}
            <CollectQrModal
                isOpen={!!collectSettlement}
                onClose={() => setCollectSettlement(null)}
                data={collectSettlement}
            />

            {/* Batch Multi-Debtor Named QR WhatsApp Share Modal */}
            <GroupCollectQrModal
                isOpen={!!groupCollectData}
                onClose={() => setGroupCollectData(null)}
                data={groupCollectData}
            />

            {/* Dedicated Month-wise Spend History Breakdown Modal */}
            <SpendHistoryModal
                isOpen={showSpendHistory}
                onClose={() => setShowSpendHistory(false)}
                initialPerson={activePerson}
                claimedPerson={claimedPerson}
            />

            {/* Lazy Camera / Screenshot QR Scanner */}
            {showQrScanner && (
                <Suspense fallback={null}>
                    <QrScannerModal
                        isOpen={showQrScanner}
                        onClose={() => setShowQrScanner(false)}
                        onScanUpi={handleScannedCreditorQr}
                        title="Scan Creditor's UPI QR"
                        subtitle="Matches pending dues or copies UPI ID"
                    />
                </Suspense>
            )}
        </div>
    );
}

export default Dashboard;
