import { useState } from 'react';
import { useExpense } from '../../context';
import { useSpendings, useSplits, useSettleParticipantMutation, useTripInfo } from '../../api';
import { Avatar, PaymentModal, type PaymentSettlementData, CollectQrModal, type CollectQrModalData } from '../../components';
import { triggerHaptic } from '../../utils/haptics';

export function Dashboard() {
    const { activePerson, setActiveTab, showToast } = useExpense();
    const { data: spendings, isLoading: isSpendingsLoading } = useSpendings(activePerson);
    const { data: allSplits = [], isLoading: isSplitsLoading } = useSplits();
    const { data: tripInfo } = useTripInfo();
    const settleMutation = useSettleParticipantMutation();
    const [paymentSettlement, setPaymentSettlement] = useState<PaymentSettlementData | null>(null);
    const [collectSettlement, setCollectSettlement] = useState<CollectQrModalData | null>(null);
    const [expandedOwed, setExpandedOwed] = useState<Record<string, boolean>>({});
    const [expandedOwedToMe, setExpandedOwedToMe] = useState<Record<string, boolean>>({});

    const activeSplits = allSplits.filter((s) => s.status === 'ACTIVE');

    // Date checker for today (matches YYYY-MM-DD or DD/MM/YYYY)
    const isTodayDate = (dateStr?: string) => {
        if (!dateStr) return false;
        const now = new Date();
        const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const todayDMY = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        return dateStr.startsWith(todayYMD) || dateStr.startsWith(todayDMY);
    };

    // 1. Direct personal expenses logged by activePerson (excluding auto-recorded split rows)
    const personalDirectExpenses = (spendings?.recentExpenses || []).filter(
        (exp) => !exp.description?.toLowerCase().includes('(split:')
    );

    // 2. Split expenses where activePerson participated
    const userSplitItems = allSplits
        .filter((split) =>
            split.participants?.some(
                (p) => p.toLowerCase() === activePerson.toLowerCase()
            )
        )
        .map((split) => {
            const count = split.participants?.length || 1;
            const myShare = Math.round((split.totalAmount / count) * 100) / 100;
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
    const directTotal = personalDirectExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const splitsTotal = userSplitItems.reduce((sum, s) => sum + s.myShare, 0);
    const userTotalSpend = directTotal + splitsTotal;

    const directToday = personalDirectExpenses
        .filter((e) => isTodayDate(e.timestamp))
        .reduce((sum, e) => sum + (e.amount || 0), 0);
    const splitsToday = userSplitItems
        .filter((s) => s.isToday)
        .reduce((sum, s) => sum + s.myShare, 0);
    const userTodaySpend = directToday + splitsToday;

    const userMonthSpend = userTotalSpend;
    const totalUserExpensesCount = personalDirectExpenses.length + userSplitItems.length;

    // Upfront bill coverage (if user covered bills upfront for the group)
    const upfrontPaidByActiveUser = allSplits
        .filter((s) => s.paidBy?.toLowerCase() === activePerson.toLowerCase())
        .reduce((sum, s) => sum + s.totalAmount, 0);

    // Combined activity items for activePerson
    const combinedRecentItems = [
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
    ].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

    // Calculate personal settlements from active splits
    const myOwedSettlements: {
        splitId: string;
        description: string;
        to: string;
        amount: number;
        toUpiId?: string | null;
        upiIntent?: string;
        appLinks?: import('../../api/types').SettlementAppLinks;
    }[] = [];

    const owedToMeSettlements: {
        splitId: string;
        description: string;
        from: string;
        amount: number;
    }[] = [];

    activeSplits.forEach((split) => {
        split.settlements?.forEach((s) => {
            if (s.status === 'PENDING') {
                if (s.from.toLowerCase() === activePerson.toLowerCase()) {
                    myOwedSettlements.push({
                        splitId: split.splitId,
                        description: split.description,
                        to: s.to,
                        amount: s.amount,
                        toUpiId: s.toUpiId,
                        upiIntent: s.upiIntent,
                        appLinks: s.appLinks,
                    });
                }
                if (s.to.toLowerCase() === activePerson.toLowerCase()) {
                    owedToMeSettlements.push({
                        splitId: split.splitId,
                        description: split.description,
                        from: s.from,
                        amount: s.amount,
                    });
                }
            }
        });
    });

    const totalYouOwe = myOwedSettlements.reduce((sum, s) => sum + s.amount, 0);
    const totalOwedToYou = owedToMeSettlements.reduce((sum, s) => sum + s.amount, 0);
    const netBalance = totalOwedToYou - totalYouOwe;

    // Consolidated Pairwise Grouping for Step 3
    interface GroupedOwedSettlement {
        to: string;
        totalAmount: number;
        toUpiId?: string | null;
        upiIntent?: string;
        appLinks?: import('../../api/types').SettlementAppLinks;
        splits: {
            splitId: string;
            description: string;
            amount: number;
        }[];
    }

    interface GroupedOwedToMeSettlement {
        from: string;
        totalAmount: number;
        splits: {
            splitId: string;
            description: string;
            amount: number;
        }[];
    }

    const groupedOwedList = Object.values(
        myOwedSettlements.reduce<Record<string, GroupedOwedSettlement>>((acc, s) => {
            if (!acc[s.to]) {
                acc[s.to] = {
                    to: s.to,
                    totalAmount: 0,
                    toUpiId: s.toUpiId,
                    upiIntent: s.upiIntent,
                    appLinks: s.appLinks,
                    splits: [],
                };
            }
            acc[s.to].totalAmount += s.amount;
            if (!acc[s.to].toUpiId && s.toUpiId) acc[s.to].toUpiId = s.toUpiId;
            if (!acc[s.to].upiIntent && s.upiIntent) acc[s.to].upiIntent = s.upiIntent;
            if (!acc[s.to].appLinks && s.appLinks) acc[s.to].appLinks = s.appLinks;
            acc[s.to].splits.push({
                splitId: s.splitId,
                description: s.description,
                amount: s.amount,
            });
            return acc;
        }, {})
    );

    const groupedOwedToMeList = Object.values(
        owedToMeSettlements.reduce<Record<string, GroupedOwedToMeSettlement>>((acc, s) => {
            if (!acc[s.from]) {
                acc[s.from] = {
                    from: s.from,
                    totalAmount: 0,
                    splits: [],
                };
            }
            acc[s.from].totalAmount += s.amount;
            acc[s.from].splits.push({
                splitId: s.splitId,
                description: s.description,
                amount: s.amount,
            });
            return acc;
        }, {})
    );

    const handleSettle = async (splitId: string, fromPerson: string, toPerson: string) => {
        try {
            await settleMutation.mutateAsync({
                splitId,
                from: fromPerson,
                to: toPerson,
                confirmedBy: activePerson,
            });
            triggerHaptic('success');
            showToast(`Confirmed receipt of payment from ${fromPerson}!`, 'check_circle');
        } catch (err: unknown) {
            triggerHaptic('warning');
            showToast(`Failed to settle: ${String(err)}`, 'error');
        }
    };

    const handleSettleMultiple = async (splitIds: string[], fromPerson: string, toPerson: string) => {
        try {
            for (const sId of splitIds) {
                await settleMutation.mutateAsync({
                    splitId: sId,
                    from: fromPerson,
                    to: toPerson,
                    confirmedBy: activePerson,
                });
            }
            triggerHaptic('success');
            showToast(`Confirmed receipt of payment from ${fromPerson}!`, 'check_circle');
        } catch (err: unknown) {
            triggerHaptic('warning');
            showToast(`Failed to settle: ${String(err)}`, 'error');
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
                    className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-2xs shrink-0 border ${
                        netBalance > 0
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
                            {owedToMeSettlements.length > 0
                                ? `From ${owedToMeSettlements.length} ${owedToMeSettlements.length === 1 ? 'person' : 'people'}`
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
                            className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                totalYouOwe > 0
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
                            className={`text-xl font-bold tracking-tight font-mono ${
                                totalYouOwe > 0 ? 'text-error' : 'text-on-surface'
                            }`}
                        >
                            ₹{totalYouOwe.toLocaleString('en-IN')}
                        </p>
                        <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                            {myOwedSettlements.length > 0
                                ? `To ${myOwedSettlements.length} ${myOwedSettlements.length === 1 ? 'person' : 'people'}`
                                : 'All cleared'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Spendings Bento Summary Cards for Active User */}
            <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                    {/* Total Spend by Active Person */}
                    <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-xs border border-outline-variant/30 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-primary-fixed/20 pointer-events-none" />
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-outline tracking-wider font-mono">
                                YOUR SPEND
                            </span>
                            <div className="w-6 h-6 rounded-full bg-primary-fixed flex items-center justify-center text-primary">
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

            {/* Pending Settlements for Active Person */}
            {(myOwedSettlements.length > 0 || owedToMeSettlements.length > 0) && (
                <div className="space-y-2.5">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-base font-bold text-on-surface font-headline">
                            Action Required on Splits
                        </h2>
                        <span className="text-xs text-primary font-semibold">
                            {myOwedSettlements.length + owedToMeSettlements.length} Pending
                        </span>
                    </div>

                    {/* What you owe (Grouped / Consolidated Pairwise) */}
                    {groupedOwedList.map((group, idx) => {
                        const isMulti = group.splits.length > 1;
                        const isExpanded = !!expandedOwed[group.to];

                        return (
                            <div
                                key={`owe-group-${group.to}-${idx}`}
                                className="bg-surface-container-lowest p-3.5 rounded-xl shadow-xs border border-outline-variant/30 space-y-2.5"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Avatar name={group.to} size="md" />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h4 className="font-semibold text-sm text-on-surface truncate">
                                                    Pay {group.to}
                                                </h4>
                                                {isMulti && (
                                                    <span className="px-1.5 py-0.2 rounded-md bg-secondary-fixed/50 text-on-secondary-fixed text-[10px] font-bold">
                                                        {group.splits.length} splits
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-on-surface-variant truncate">
                                                {isMulti
                                                    ? group.splits.map((s) => s.description).join(', ')
                                                    : `For ${group.splits[0].description}`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="font-bold text-sm text-error font-mono">
                                            ₹{group.totalAmount.toLocaleString('en-IN')}
                                        </span>
                                        {group.upiIntent || group.toUpiId ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPaymentSettlement({
                                                        to: group.to,
                                                        from: activePerson,
                                                        splitId: isMulti ? undefined : group.splits[0].splitId,
                                                        splitIds: isMulti ? group.splits.map((s) => s.splitId) : undefined,
                                                        amount: group.totalAmount,
                                                        toUpiId: group.toUpiId,
                                                        upiIntent: group.upiIntent,
                                                        appLinks: group.appLinks,
                                                        description: isMulti
                                                            ? `Consolidated payoff (${group.splits.length} splits)`
                                                            : group.splits[0].description,
                                                    });
                                                }}
                                                className="h-8 px-2.5 rounded-lg bg-primary text-on-primary text-xs font-semibold flex items-center gap-1 shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-[15px]">
                                                    bolt
                                                </span>
                                                <span>{isMulti ? 'Pay All' : 'Pay'}</span>
                                            </button>
                                        ) : (
                                            <span className="text-[11px] text-on-surface-variant font-medium flex items-center gap-0.5">
                                                <span className="material-symbols-outlined text-[13px] text-tertiary">
                                                    hourglass_top
                                                </span>
                                                <span>Pending {group.to}</span>
                                            </span>
                                        )}

                                        {isMulti && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setExpandedOwed((prev) => ({
                                                        ...prev,
                                                        [group.to]: !prev[group.to],
                                                    }))
                                                }
                                                className="w-7 h-7 rounded-lg text-on-surface-variant hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer"
                                                title={isExpanded ? 'Collapse breakdown' : 'Expand breakdown'}
                                            >
                                                <span className="material-symbols-outlined text-[18px]">
                                                    {isExpanded ? 'expand_less' : 'expand_more'}
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Consolidated Breakdown Sub-list */}
                                {isMulti && isExpanded && (
                                    <div className="pt-2 border-t border-outline-variant/20 space-y-1.5 pl-2">
                                        {group.splits.map((s) => (
                                            <div
                                                key={`owed-sub-${s.splitId}`}
                                                className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-surface-container-low"
                                            >
                                                <span className="text-on-surface truncate font-medium">
                                                    {s.description}
                                                </span>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="font-mono text-error font-semibold">
                                                        ₹{s.amount.toLocaleString('en-IN')}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setPaymentSettlement({
                                                                to: group.to,
                                                                from: activePerson,
                                                                splitId: s.splitId,
                                                                amount: s.amount,
                                                                toUpiId: group.toUpiId,
                                                                description: s.description,
                                                            });
                                                        }}
                                                        className="px-2 py-0.5 rounded bg-surface-container-high text-primary hover:bg-primary/10 text-[11px] font-bold cursor-pointer"
                                                    >
                                                        Pay
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* What others owe you (Creditor: Collect via QR or Settle) */}
                    {groupedOwedToMeList.map((group, idx) => {
                        const isMulti = group.splits.length > 1;
                        const isExpanded = !!expandedOwedToMe[group.from];

                        return (
                            <div
                                key={`owed-to-me-group-${group.from}-${idx}`}
                                className="bg-surface-container-lowest p-3.5 rounded-xl shadow-xs border border-outline-variant/30 space-y-2.5"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Avatar name={group.from} size="md" />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h4 className="font-semibold text-sm text-on-surface truncate">
                                                    {group.from} owes you
                                                </h4>
                                                {isMulti && (
                                                    <span className="px-1.5 py-0.2 rounded-md bg-primary-fixed text-on-primary-fixed text-[10px] font-bold">
                                                        {group.splits.length} splits
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-on-surface-variant truncate">
                                                {isMulti
                                                    ? group.splits.map((s) => s.description).join(', ')
                                                    : `For ${group.splits[0].description}`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="font-bold text-sm text-primary font-mono mr-1">
                                            ₹{group.totalAmount.toLocaleString('en-IN')}
                                        </span>

                                        {/* Collect via QR button */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCollectSettlement({
                                                    debtorName: group.from,
                                                    amount: group.totalAmount,
                                                    splitId: isMulti ? undefined : group.splits[0].splitId,
                                                    splitIds: isMulti ? group.splits.map((s) => s.splitId) : undefined,
                                                    description: isMulti
                                                        ? `${group.splits.length} splits combined`
                                                        : group.splits[0].description,
                                                });
                                            }}
                                            className="h-8 px-2 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors flex items-center justify-center border border-outline-variant/40 cursor-pointer"
                                            title={`Show QR code to collect ₹${group.totalAmount} from ${group.from}`}
                                        >
                                            <span className="material-symbols-outlined text-[17px] text-primary">
                                                qr_code_2
                                            </span>
                                            {isMulti && <span className="text-[11px] font-bold ml-1">QR</span>}
                                        </button>

                                        {/* Confirm Received button */}
                                        <button
                                            type="button"
                                            disabled={settleMutation.isPending}
                                            onClick={() =>
                                                isMulti
                                                    ? handleSettleMultiple(
                                                          group.splits.map((s) => s.splitId),
                                                          group.from,
                                                          activePerson
                                                      )
                                                    : handleSettle(
                                                          group.splits[0].splitId,
                                                          group.from,
                                                          activePerson
                                                      )
                                            }
                                            className="h-8 px-2.5 rounded-lg bg-primary-fixed text-on-primary-fixed text-xs font-bold hover:bg-primary hover:text-on-primary transition-colors flex items-center gap-1 shadow-2xs disabled:opacity-50 cursor-pointer"
                                            title={`Confirm receipt of ₹${group.totalAmount} from ${group.from}`}
                                        >
                                            <span className="material-symbols-outlined text-[14px]">
                                                done_all
                                            </span>
                                            <span>{isMulti ? 'Confirm All' : 'Confirm'}</span>
                                        </button>

                                        {isMulti && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setExpandedOwedToMe((prev) => ({
                                                        ...prev,
                                                        [group.from]: !prev[group.from],
                                                    }))
                                                }
                                                className="w-7 h-7 rounded-lg text-on-surface-variant hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer"
                                                title={isExpanded ? 'Collapse breakdown' : 'Expand breakdown'}
                                            >
                                                <span className="material-symbols-outlined text-[18px]">
                                                    {isExpanded ? 'expand_less' : 'expand_more'}
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Consolidated Breakdown Sub-list */}
                                {isMulti && isExpanded && (
                                    <div className="pt-2 border-t border-outline-variant/20 space-y-1.5 pl-2">
                                        {group.splits.map((s) => (
                                            <div
                                                key={`owed-to-me-sub-${s.splitId}`}
                                                className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-surface-container-low"
                                            >
                                                <span className="text-on-surface truncate font-medium">
                                                    {s.description}
                                                </span>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <span className="font-mono text-primary font-semibold">
                                                        ₹{s.amount.toLocaleString('en-IN')}
                                                    </span>
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
                                                        className="p-1 rounded bg-surface-container-high text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                                        title="Show QR for this item"
                                                    >
                                                        <span className="material-symbols-outlined text-[15px]">
                                                            qr_code_2
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={settleMutation.isPending}
                                                        onClick={() =>
                                                            handleSettle(s.splitId, group.from, activePerson)
                                                        }
                                                        className="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed hover:bg-primary hover:text-on-primary text-[11px] font-bold cursor-pointer disabled:opacity-50"
                                                    >
                                                        Confirm
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Recent Expenses List for Active Person */}
            <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-base font-bold text-on-surface font-headline">
                        Recent Spendings by {activePerson}
                    </h2>
                    <span className="text-xs text-on-surface-variant font-mono">
                        {combinedRecentItems.length} {combinedRecentItems.length === 1 ? 'item' : 'items'}
                    </span>
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
                    <div className="space-y-2">
                        {combinedRecentItems.map((item) => (
                            <div
                                key={item.id}
                                className="bg-surface-container-lowest p-3.5 rounded-xl shadow-xs border border-outline-variant/30 flex items-center justify-between gap-3"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0">
                                        <span className="material-symbols-outlined text-[20px]">
                                            {item.category.toLowerCase().includes('food')
                                                ? 'restaurant'
                                                : item.category.toLowerCase().includes('water')
                                                ? 'water_drop'
                                                : item.category.toLowerCase().includes('travel')
                                                ? 'directions_car'
                                                : item.category.toLowerCase().includes('activity')
                                                ? 'snowboarding'
                                                : 'receipt_long'}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <h4 className="font-semibold text-sm text-on-surface truncate">
                                                {item.description}
                                            </h4>
                                            <span
                                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                                    item.isSplitShare
                                                        ? 'bg-primary-fixed text-on-primary-fixed'
                                                        : 'bg-surface-container-high text-on-surface-variant'
                                                }`}
                                            >
                                                {item.badge}
                                            </span>
                                        </div>
                                        <p className="text-xs text-outline truncate mt-0.5">
                                            {item.category}{' '}
                                            {item.isSplitShare && item.paidBy
                                                ? `• Bill paid by ${item.paidBy}`
                                                : ''}{' '}
                                            {item.timestamp ? `• ${item.timestamp}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-bold text-sm font-mono text-primary">
                                        ₹{item.amount.toLocaleString('en-IN')}
                                    </p>
                                    {item.isSplitShare && item.totalBill && (
                                        <span className="text-[10px] text-on-surface-variant font-mono block">
                                            of ₹{item.totalBill.toLocaleString('en-IN')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
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
        </div>
    );
}

export default Dashboard;
