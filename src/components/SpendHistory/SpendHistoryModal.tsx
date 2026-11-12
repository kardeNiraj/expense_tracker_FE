import React, { useState, useMemo } from 'react';
import { useSpendings, useSplits, usePeople } from '../../api';
import { useExpense } from '../../context';
import { Avatar } from '../Avatar';
import { triggerHaptic } from '../../utils/haptics';
import {
    parseCustomDate,
    formatPurchaseTime,
    getCategoryMeta,
    formatMonthYear,
} from '../../utils/formatters';
import type { ExpenseRecord } from '../../api/types';
import { AppIcon } from '../Icon/AppIcon';
import { SpendHistorySkeleton } from '../Skeleton/AppSkeleton';

interface SpendHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialPerson?: string;
    claimedPerson?: string | null;
}

export interface UnifiedTransactionItem {
    id: string;
    type: 'PERSONAL' | 'SPLIT';
    description: string;
    category: string;
    amount: number;
    timestamp?: string;
    month: string;
    paidBy: string;
    isSplitShare: boolean;
    totalBill?: number;
    splitId?: string;
    participantsCount?: number;
}

const SpendHistoryContent: React.FC<Omit<SpendHistoryModalProps, 'isOpen'>> = ({
    onClose,
    initialPerson,
    claimedPerson: propClaimedPerson,
}) => {
    const { activePerson, claimedPerson: contextClaimed, isSwitcherUnlocked } = useExpense();
    const effectiveClaimed = propClaimedPerson || contextClaimed || activePerson;
    // Strict privacy: regular users can ONLY see their claimed profile expenses
    const defaultPerson = isSwitcherUnlocked
        ? (initialPerson || activePerson)
        : effectiveClaimed;

    const { data: people = [] } = usePeople();
    const [selectedPerson, setSelectedPerson] = useState<string>(defaultPerson);
    const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'PERSONAL' | 'SPLIT'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch spendings for the selected person
    const {
        data: spendings,
        isLoading: isSpendingsLoading,
        isFetching: isSpendingsFetching,
        refetch: refetchSpendings,
    } = useSpendings(selectedPerson);

    // Fetch all splits
    const {
        data: allSplits = [],
        isLoading: isSplitsLoading,
        refetch: refetchSplits,
    } = useSplits();

    // Handle back / dismiss
    const handleBack = () => {
        triggerHaptic('light');
        onClose();
    };

    // Refresh data
    const handleRefresh = async () => {
        triggerHaptic('medium');
        await Promise.all([refetchSpendings(), refetchSplits()]);
    };

    // 1. Gather all direct personal expenses for selectedPerson (excluding split rows)
    const directExpenses: UnifiedTransactionItem[] = useMemo(() => {
        const rawList: ExpenseRecord[] =
            spendings?.allExpenses || spendings?.recentExpenses || [];

        return rawList
            .filter((exp) => !exp.description?.toLowerCase().includes('(split:'))
            .map((exp, idx) => {
                const month = exp.sheet || formatMonthYear(exp.timestamp);
                return {
                    id: `direct-${idx}-${exp.timestamp || ''}`,
                    type: 'PERSONAL',
                    description: exp.description || 'Personal Expense',
                    category: exp.category || 'General',
                    amount: exp.amount || 0,
                    timestamp: exp.timestamp,
                    month,
                    paidBy: selectedPerson,
                    isSplitShare: false,
                    totalBill: exp.amount || 0,
                };
            });
    }, [spendings, selectedPerson]);

    // 2. Gather all split shares where selectedPerson participated or paid upfront
    const splitShareExpenses: UnifiedTransactionItem[] = useMemo(() => {
        const lowerPerson = selectedPerson.toLowerCase();

        return allSplits
            .filter(
                (split) =>
                    split.status?.toUpperCase() !== 'DELETED' &&
                    (split.participants?.some((p) => p.toLowerCase() === lowerPerson) ||
                        split.paidBy?.toLowerCase() === lowerPerson)
            )
            .map((split) => {
                const isParticipant = split.participants?.some(
                    (p) => p.toLowerCase() === lowerPerson
                );
                const count = split.participants?.length || 1;
                const mySettlement = split.settlements?.find(
                    (s) => s.from.toLowerCase() === lowerPerson
                );

                let myShare = 0;
                if (mySettlement) {
                    myShare = mySettlement.amount;
                } else if (isParticipant) {
                    if (
                        split.paidBy?.toLowerCase() === lowerPerson &&
                        split.settlements?.length > 0
                    ) {
                        const othersOwe = split.settlements.reduce(
                            (sum, s) => sum + s.amount,
                            0
                        );
                        myShare = Math.max(
                            0,
                            Math.round((split.totalAmount - othersOwe) * 100) / 100
                        );
                    } else {
                        myShare = Math.round((split.totalAmount / count) * 100) / 100;
                    }
                }

                const month = formatMonthYear(split.timestamp);

                return {
                    id: `split-${split.splitId}`,
                    type: 'SPLIT',
                    description: split.description || 'Split Expense',
                    category: split.category || 'General',
                    amount: myShare,
                    timestamp: split.timestamp,
                    month,
                    paidBy: split.paidBy,
                    isSplitShare: true,
                    totalBill: split.totalAmount,
                    splitId: split.splitId,
                    participantsCount: count,
                };
            });
    }, [allSplits, selectedPerson]);

    // 3. Combined unified transactions for selectedPerson, sorted newest first
    const allUnifiedTransactions: UnifiedTransactionItem[] = useMemo(() => {
        const combined = [...directExpenses, ...splitShareExpenses];
        return combined.sort((a, b) => {
            const timeA = parseCustomDate(a.timestamp)?.getTime() || 0;
            const timeB = parseCustomDate(b.timestamp)?.getTime() || 0;
            return timeB - timeA;
        });
    }, [directExpenses, splitShareExpenses]);

    // 4. Overall Totals for selectedPerson
    const directTotalSum = useMemo(
        () => Math.round(directExpenses.reduce((sum, e) => sum + e.amount, 0) * 100) / 100,
        [directExpenses]
    );

    const splitSharesSum = useMemo(
        () => Math.round(splitShareExpenses.reduce((sum, e) => sum + e.amount, 0) * 100) / 100,
        [splitShareExpenses]
    );

    const grandTotalSpend = Math.round((directTotalSum + splitSharesSum) * 100) / 100;

    // Upfront bill coverage (total amount of bills paid upfront for the group by selectedPerson)
    const upfrontPaidBySelected = useMemo(() => {
        const lowerPerson = selectedPerson.toLowerCase();
        return allSplits
            .filter(
                (s) =>
                    s.status?.toUpperCase() !== 'DELETED' &&
                    s.paidBy?.toLowerCase() === lowerPerson
            )
            .reduce((sum, s) => sum + s.totalAmount, 0);
    }, [allSplits, selectedPerson]);

    // 5. Unique months list in reverse chronological order
    const availableMonths = useMemo(() => {
        const monthsSet = new Set<string>();
        allUnifiedTransactions.forEach((t) => {
            if (t.month && t.month !== 'Other') {
                monthsSet.add(t.month);
            }
        });
        const list = Array.from(monthsSet);
        list.sort((a, b) => {
            const dateA = new Date(`1 ${a}`);
            const dateB = new Date(`1 ${b}`);
            return dateB.getTime() - dateA.getTime();
        });
        return list;
    }, [allUnifiedTransactions]);

    // 6. Filtered transactions according to selectedMonth, typeFilter, and searchQuery
    const filteredTransactions = useMemo(() => {
        return allUnifiedTransactions.filter((item) => {
            if (selectedMonth !== 'ALL' && item.month !== selectedMonth) {
                return false;
            }
            if (typeFilter === 'PERSONAL' && item.type !== 'PERSONAL') {
                return false;
            }
            if (typeFilter === 'SPLIT' && item.type !== 'SPLIT') {
                return false;
            }
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim();
                const descMatch = item.description.toLowerCase().includes(query);
                const catMatch = item.category.toLowerCase().includes(query);
                const amtMatch = String(item.amount).includes(query);
                if (!descMatch && !catMatch && !amtMatch) {
                    return false;
                }
            }
            return true;
        });
    }, [allUnifiedTransactions, selectedMonth, typeFilter, searchQuery]);

    // 7. Month-Wise Grouping of the filtered transactions
    const monthGroups = useMemo(() => {
        const map = new Map<string, UnifiedTransactionItem[]>();

        // Initialize with available months order
        const monthsToInclude =
            selectedMonth === 'ALL' ? availableMonths : [selectedMonth];

        monthsToInclude.forEach((m) => {
            map.set(m, []);
        });

        filteredTransactions.forEach((item) => {
            const m = item.month || 'Other';
            if (!map.has(m)) {
                map.set(m, []);
            }
            map.get(m)!.push(item);
        });

        // Filter out empty months unless a specific month was explicitly selected
        const result: {
            month: string;
            items: UnifiedTransactionItem[];
            total: number;
            directTotal: number;
            splitTotal: number;
        }[] = [];

        map.forEach((items, month) => {
            if (items.length > 0 || selectedMonth === month) {
                const directTotal = Math.round(
                    items.filter((i) => i.type === 'PERSONAL').reduce((s, i) => s + i.amount, 0) * 100
                ) / 100;
                const splitTotal = Math.round(
                    items.filter((i) => i.type === 'SPLIT').reduce((s, i) => s + i.amount, 0) * 100
                ) / 100;
                const total = Math.round((directTotal + splitTotal) * 100) / 100;

                result.push({
                    month,
                    items,
                    total,
                    directTotal,
                    splitTotal,
                });
            }
        });

        return result;
    }, [filteredTransactions, availableMonths, selectedMonth]);

    const isLoading = isSpendingsLoading || isSplitsLoading;

    return (
        <div
            className="fixed inset-0 z-60 bg-surface flex flex-col overflow-hidden animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-label={`All Spendings for ${selectedPerson}`}
        >
            {/* Top Navigation Bar */}
            <header className="sticky top-0 inset-x-0 z-30 pt-safe bg-surface/95 backdrop-blur-xl border-b border-outline-variant/20 shadow-xs shrink-0">
                <div className="max-w-md mx-auto h-16 px-4 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors cursor-pointer"
                        title="Back to Overview"
                    >
                        <AppIcon name="arrow_back" className="text-[20px]" />
                    </button>

                    <div className="flex-1 min-w-0 text-center">
                        <h1 className="text-base font-bold text-on-surface truncate font-headline">
                            Spend History & Breakdown
                        </h1>
                        <p className="text-[11px] text-on-surface-variant truncate">
                            Month-wise segregated transactions
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isSpendingsFetching}
                        className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors cursor-pointer disabled:opacity-50"
                        title="Refresh transactions"
                    >
                        <AppIcon
                            name="refresh"
                            className={`text-[19px] ${
                                isSpendingsFetching ? 'animate-spin text-primary' : ''
                            }`}
                        />
                    </button>
                </div>

                {/* User Identity / Privacy Badge Bar */}
                {isSwitcherUnlocked ? (
                    <div className="max-w-md mx-auto px-4 pb-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-primary font-bold">
                            <span className="flex items-center gap-1">
                                <AppIcon name="admin_panel_settings" className="text-[12px]" />
                                <span>Admin Switcher Unlocked</span>
                            </span>
                            <span className="font-mono">Viewing: {selectedPerson}</span>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                            {people.map((person) => {
                                const isSelected = person.toLowerCase() === selectedPerson.toLowerCase();

                                return (
                                    <button
                                        key={person}
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic('selection');
                                            setSelectedPerson(person);
                                        }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                                            isSelected
                                                ? 'bg-primary text-on-primary shadow-xs ring-2 ring-primary/20 scale-[1.02]'
                                                : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                                        }`}
                                    >
                                        <Avatar name={person} size="sm" />
                                        <span>{person}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    /* Locked to Claimed Profile: Privacy Preserved */
                    <div className="max-w-md mx-auto px-4 pb-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                            <Avatar name={selectedPerson} size="sm" />
                            <div className="min-w-0">
                                <span className="font-bold text-xs text-on-surface block leading-tight truncate">
                                    {selectedPerson}
                                </span>
                                <span className="text-[10px] text-on-surface-variant block truncate">
                                    Your personal expenses & split shares
                                </span>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                            <AppIcon name="verified_user" className="text-[13px]" />
                            <span>Claimed</span>
                        </span>
                    </div>
                )}
            </header>

            {/* Scrollable Content Container */}
            <main className="flex-1 w-full max-w-md mx-auto px-4 py-4 overflow-y-auto overscroll-contain space-y-4 pb-safe">
                {/* Grand Total Hero Card for selectedPerson */}
                <div className="p-4 rounded-3xl bg-linear-to-br from-primary/10 via-surface-container-lowest to-surface-container border border-primary/20 shadow-xs relative overflow-hidden">
                    <div className="flex items-start justify-between gap-3 relative z-10">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                                    Total Spend by {selectedPerson}
                                </span>
                                {effectiveClaimed?.toLowerCase() === selectedPerson.toLowerCase() && (
                                    <span className="text-[10px] bg-primary text-on-primary font-bold px-1.5 py-0.2 rounded-full">
                                        Your Profile
                                    </span>
                                )}
                            </div>
                            {isLoading ? (
                                <div className="h-9 w-36 rounded-xl bg-outline-variant/25 animate-pulse my-0.5" />
                            ) : (
                                <div className="text-3xl font-extrabold text-on-surface font-mono tracking-tight">
                                    ₹{grandTotalSpend.toLocaleString('en-IN')}
                                </div>
                            )}
                            <p className="text-[11px] text-on-surface-variant">
                                Across all {availableMonths.length} active{' '}
                                {availableMonths.length === 1 ? 'month' : 'months'}
                            </p>
                        </div>

                        <div className="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0 shadow-2xs">
                            <AppIcon name="account_balance_wallet" className="text-[26px]" />
                        </div>
                    </div>

                    {/* Breakdown Chips */}
                    <div className="grid grid-cols-2 gap-2 mt-3.5 pt-3 border-t border-outline-variant/20 relative z-10">
                        <div className="p-2.5 rounded-2xl bg-surface-container-lowest/80 border border-outline-variant/20">
                            <div className="text-[10px] font-bold text-on-surface-variant flex items-center gap-1">
                                <AppIcon name="receipt_long" className="text-[14px] text-primary" />
                                <span>Personal Direct</span>
                            </div>
                            {isLoading ? (
                                <div className="h-5 w-20 rounded-md bg-outline-variant/25 animate-pulse mt-1" />
                            ) : (
                                <div className="text-sm font-mono font-bold text-on-surface mt-0.5">
                                    ₹{directTotalSum.toLocaleString('en-IN')}
                                </div>
                            )}
                            <div className="text-[10px] text-on-surface-variant font-mono">
                                {directExpenses.length} {directExpenses.length === 1 ? 'item' : 'items'}
                            </div>
                        </div>

                        <div className="p-2.5 rounded-2xl bg-surface-container-lowest/80 border border-outline-variant/20">
                            <div className="text-[10px] font-bold text-on-surface-variant flex items-center gap-1">
                                <AppIcon name="call_split" className="text-[14px] text-secondary" />
                                <span>Split Shares</span>
                            </div>
                            {isLoading ? (
                                <div className="h-5 w-20 rounded-md bg-outline-variant/25 animate-pulse mt-1" />
                            ) : (
                                <div className="text-sm font-mono font-bold text-on-surface mt-0.5">
                                    ₹{splitSharesSum.toLocaleString('en-IN')}
                                </div>
                            )}
                            <div className="text-[10px] text-on-surface-variant font-mono">
                                {splitShareExpenses.length} {splitShareExpenses.length === 1 ? 'split' : 'splits'}
                            </div>
                        </div>
                    </div>

                    {upfrontPaidBySelected > 0 && (
                        <div className="mt-2 p-2 rounded-xl bg-primary/5 border border-primary/15 flex items-center justify-between text-[11px] relative z-10">
                            <span className="text-on-surface-variant flex items-center gap-1">
                                <AppIcon name="payments" className="text-[14px] text-primary" />
                                <span>Total Bills Covered Upfront:</span>
                            </span>
                            <span className="font-mono font-bold text-primary">
                                ₹{upfrontPaidBySelected.toLocaleString('en-IN')}
                            </span>
                        </div>
                    )}
                </div>

                {/* Filters & Month Pills */}
                <div className="space-y-2.5 sticky top-0 z-20 bg-surface/90 backdrop-blur-md pt-1 pb-2">
                    {/* Search & Type Filter Row */}
                    <div className="flex items-center gap-2">
                        {/* Search Input */}
                        <div className="flex-1 flex items-center h-10 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 focus-within:border-primary">
                            <AppIcon name="search" className="text-[18px] text-on-surface-variant mr-1.5" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search transaction or amount..."
                                className="w-full bg-transparent text-xs text-on-surface focus:outline-hidden"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    aria-label="Clear search"
                                    className="text-on-surface-variant hover:text-on-surface"
                                >
                                    <AppIcon name="close" className="text-[16px]" />
                                </button>
                            )}
                        </div>

                        {/* Type Filter Buttons */}
                        <div className="flex items-center p-1 rounded-xl bg-surface-container-low border border-outline-variant/30 shrink-0">
                            {(['ALL', 'PERSONAL', 'SPLIT'] as const).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic('selection');
                                        setTypeFilter(t);
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                        typeFilter === t
                                            ? 'bg-surface-container-lowest text-primary shadow-2xs font-extrabold'
                                            : 'text-on-surface-variant hover:text-on-surface'
                                    }`}
                                >
                                    {t === 'ALL' ? 'All' : t === 'PERSONAL' ? 'Personal' : 'Splits'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Month Filter Selector Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic('selection');
                                setSelectedMonth('ALL');
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                                selectedMonth === 'ALL'
                                    ? 'bg-primary text-on-primary font-bold shadow-2xs'
                                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                            }`}
                        >
                            All Months ({allUnifiedTransactions.length})
                        </button>

                        {availableMonths.map((m) => {
                            const count = allUnifiedTransactions.filter((t) => t.month === m).length;
                            const isSelected = selectedMonth === m;

                            return (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic('selection');
                                        setSelectedMonth(m);
                                    }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                                        isSelected
                                            ? 'bg-primary text-on-primary font-bold shadow-2xs'
                                            : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                                    }`}
                                >
                                    <span>{m}</span>
                                    <span
                                        className={`text-[10px] font-mono px-1 rounded-full ${
                                            isSelected
                                                ? 'bg-on-primary/20 text-on-primary'
                                                : 'bg-outline-variant/30 text-on-surface-variant'
                                        }`}
                                    >
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Main Transaction Body */}
                {isLoading ? (
                    <SpendHistorySkeleton />
                ) : monthGroups.length === 0 ? (
                    <div className="bg-surface-container-lowest p-8 rounded-3xl text-center border border-outline-variant/30 space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-surface-container text-on-surface-variant flex items-center justify-center mx-auto">
                            <AppIcon name="receipt_long" className="text-[24px]" />
                        </div>
                        <h3 className="font-bold text-sm text-on-surface">No Transactions Found</h3>
                        <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
                            {searchQuery
                                ? `No spending matches "${searchQuery}" in this view.`
                                : `No expenses or split shares recorded for ${selectedPerson} yet.`}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {monthGroups.map((group) => (
                            <section
                                key={group.month}
                                className="space-y-2.5 animate-in fade-in duration-200"
                            >
                                {/* Month Section Header with Subtotals */}
                                <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between gap-3 shadow-2xs">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <AppIcon name="calendar_month" className="text-primary text-[18px]" />
                                            <h2 className="font-bold text-sm text-on-surface truncate font-headline">
                                                {group.month}
                                            </h2>
                                        </div>
                                        <div className="text-[10px] text-on-surface-variant mt-0.5 font-mono flex items-center gap-1.5 flex-wrap">
                                            <span>Direct: ₹{group.directTotal.toLocaleString('en-IN')}</span>
                                            <span>•</span>
                                            <span>Splits: ₹{group.splitTotal.toLocaleString('en-IN')}</span>
                                            <span>•</span>
                                            <span>
                                                {group.items.length}{' '}
                                                {group.items.length === 1 ? 'item' : 'items'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <div className="text-[10px] uppercase font-bold text-on-surface-variant">
                                            Month Total
                                        </div>
                                        <div className="text-base font-extrabold text-primary font-mono">
                                            ₹{group.total.toLocaleString('en-IN')}
                                        </div>
                                    </div>
                                </div>

                                {/* Month Transaction Cards */}
                                <div className="space-y-2">
                                    {group.items.map((item) => {
                                        const catMeta = getCategoryMeta(item.category);
                                        const timeInfo = formatPurchaseTime(item.timestamp);
                                        const isPaidByMe =
                                            item.paidBy?.toLowerCase() ===
                                            selectedPerson.toLowerCase();

                                        return (
                                            <div
                                                key={item.id}
                                                className="bg-surface-container-lowest p-3.5 rounded-2xl shadow-2xs border border-outline-variant/30 hover:border-outline-variant/50 transition-all flex flex-col gap-2"
                                            >
                                                {/* Top Row: Icon, Description, Category & Badge, and Amount */}
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-start gap-3 min-w-0">
                                                        <div
                                                            className={`w-10 h-10 rounded-xl ${catMeta.bgClass} flex items-center justify-center shrink-0 mt-0.5 shadow-2xs`}
                                                        >
                                                            <AppIcon name={catMeta.icon} className={`text-[20px] ${catMeta.textClass}`} />
                                                        </div>

                                                        <div className="min-w-0">
                                                            <h4 className="font-bold text-sm text-on-surface truncate">
                                                                {item.description}
                                                            </h4>
                                                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                                <span className="text-[11px] font-semibold text-on-surface-variant">
                                                                    {item.category}
                                                                </span>
                                                                <span className="text-outline-variant text-[10px]">
                                                                    •
                                                                </span>
                                                                <span
                                                                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                                                                        item.isSplitShare
                                                                            ? 'bg-secondary/10 text-secondary'
                                                                            : 'bg-primary/10 text-primary'
                                                                    }`}
                                                                >
                                                                    {item.isSplitShare
                                                                        ? 'Split Share'
                                                                        : 'Personal'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Amount */}
                                                    <div className="text-right shrink-0">
                                                        <div className="font-bold font-mono text-sm text-on-surface">
                                                            ₹{item.amount.toLocaleString('en-IN')}
                                                        </div>
                                                        {item.isSplitShare && item.totalBill && (
                                                            <div className="text-[10px] font-mono text-on-surface-variant">
                                                                Bill: ₹{item.totalBill.toLocaleString('en-IN')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Bottom Row: Timestamp & Payer info */}
                                                <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1 border-t border-outline-variant/15">
                                                    <span className="flex items-center gap-1 font-mono text-[10px]">
                                                        <AppIcon name="schedule" className="text-[13px]" />
                                                        <span>{timeInfo.full || item.timestamp || 'Recorded'}</span>
                                                    </span>

                                                    {item.isSplitShare ? (
                                                        <span className="font-medium text-[11px]">
                                                            {isPaidByMe ? (
                                                                <span className="text-primary font-semibold">
                                                                    Paid upfront by {selectedPerson}
                                                                </span>
                                                            ) : (
                                                                <span>Paid by {item.paidBy}</span>
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-medium text-on-surface-variant">
                                                            Direct Expense
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export const SpendHistoryModal: React.FC<SpendHistoryModalProps> = ({
    isOpen,
    onClose,
    initialPerson,
    claimedPerson,
}) => {
    if (!isOpen) return null;

    return (
        <SpendHistoryContent
            key={initialPerson || 'default'}
            onClose={onClose}
            initialPerson={initialPerson}
            claimedPerson={claimedPerson}
        />
    );
};

export default SpendHistoryModal;
