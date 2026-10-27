import React, { useState } from 'react';
import { useExpense } from '../../context';
import {
    useSplits,
    useSettleParticipantMutation,
    useAddContributionMutation,
} from '../../api';
import { Avatar, PaymentModal, type PaymentSettlementData } from '../../components';
import type { Split } from '../../api/types';

export function SplitsPage() {
    const { activePerson, showToast } = useExpense();
    const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'SETTLED'>('ACTIVE');
    const [paymentSettlement, setPaymentSettlement] = useState<PaymentSettlementData | null>(null);
    const [selectedSplitForContribution, setSelectedSplitForContribution] = useState<Split | null>(null);
    const [contributionAmount, setContributionAmount] = useState('');
    const [contributionPerson, setContributionPerson] = useState('');
    const [expandedSplits, setExpandedSplits] = useState<Record<string, boolean>>({});

    const { data: splits = [], isLoading } = useSplits({ status: statusFilter });
    const settleMutation = useSettleParticipantMutation();
    const contributeMutation = useAddContributionMutation();

    const isExpanded = (splitId: string, index: number) => {
        if (expandedSplits[splitId] !== undefined) {
            return expandedSplits[splitId];
        }
        // By default expand the first split for quick context, keep the rest shrunk
        return index === 0;
    };

    const toggleSplit = (splitId: string, index: number) => {
        const current = isExpanded(splitId, index);
        setExpandedSplits((prev) => ({
            ...prev,
            [splitId]: !current,
        }));
    };

    const areAllExpanded =
        splits.length > 0 && splits.every((s, idx) => isExpanded(s.splitId, idx));

    const toggleAll = (expand: boolean) => {
        const next: Record<string, boolean> = {};
        splits.forEach((s) => {
            next[s.splitId] = expand;
        });
        setExpandedSplits(next);
    };

    const handleSettle = async (splitId: string, fromPerson: string, toPerson?: string) => {
        try {
            await settleMutation.mutateAsync({
                splitId,
                from: fromPerson,
                to: toPerson,
                confirmedBy: activePerson,
            });
            showToast(
                `Payment from ${fromPerson} confirmed settled!`,
                'check_circle'
            );
        } catch (err: unknown) {
            showToast(`Failed to settle: ${String(err)}`, 'error');
        }
    };

    const handleAddContribution = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSplitForContribution || contributeMutation.isPending) return;
        const amt = parseFloat(contributionAmount);
        if (!amt || !contributionPerson) return;

        try {
            await contributeMutation.mutateAsync({
                splitId: selectedSplitForContribution.splitId,
                person: contributionPerson,
                amount: amt,
            });
            showToast(`Added contribution of ₹${amt} by ${contributionPerson}!`);
            setSelectedSplitForContribution(null);
            setContributionAmount('');
            setContributionPerson('');
        } catch (err: unknown) {
            showToast(`Failed to add contribution: ${String(err)}`, 'error');
        }
    };

    const handleShareWhatsapp = (text?: string) => {
        if (!text) return;
        const encoded = encodeURIComponent(text);
        window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    };

    const handleCopyText = (text?: string, message = 'Summary copied to clipboard!') => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        showToast(message, 'content_copy');
    };

    const getCategoryIcon = (category: string) => {
        const c = (category || '').toLowerCase();
        if (c.includes('food') || c.includes('dine') || c.includes('snack') || c.includes('cafe') || c.includes('lunch') || c.includes('dinner')) return 'restaurant';
        if (c.includes('water') || c.includes('drink') || c.includes('beverage') || c.includes('bar')) return 'water_drop';
        if (c.includes('travel') || c.includes('cab') || c.includes('taxi') || c.includes('transport') || c.includes('fuel') || c.includes('toll')) return 'directions_car';
        if (c.includes('stay') || c.includes('hotel') || c.includes('cottage') || c.includes('room') || c.includes('resort')) return 'hotel';
        if (c.includes('activity') || c.includes('sport') || c.includes('ski') || c.includes('trek') || c.includes('adventure')) return 'snowboarding';
        if (c.includes('shopping') || c.includes('market') || c.includes('mall') || c.includes('groceries')) return 'shopping_bag';
        return 'receipt_long';
    };

    const formatDisplayDate = (dateStr?: string) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr.replace(' ', 'T'));
            if (!isNaN(d.getTime())) {
                const today = new Date();
                const isToday =
                    d.getDate() === today.getDate() &&
                    d.getMonth() === today.getMonth() &&
                    d.getFullYear() === today.getFullYear();

                if (isToday) return 'Today';

                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                const isYesterday =
                    d.getDate() === yesterday.getDate() &&
                    d.getMonth() === yesterday.getMonth() &&
                    d.getFullYear() === yesterday.getFullYear();

                if (isYesterday) return 'Yesterday';

                return d.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                });
            }
        } catch {
            // fallback to raw date prefix
        }
        return dateStr.split(' ')[0] || dateStr;
    };

    const getUserSplitStake = (split: Split, activeUser: string) => {
        if (!activeUser) return null;
        const isPayer = split.paidBy.toLowerCase() === activeUser.toLowerCase();
        const isParticipant = split.participants?.some(
            (p) => p.toLowerCase() === activeUser.toLowerCase()
        );

        if (isPayer) {
            const pendingReceivable =
                split.settlements
                    ?.filter(
                        (s) =>
                            s.to.toLowerCase() === activeUser.toLowerCase() &&
                            s.status === 'PENDING'
                    )
                    .reduce((sum, s) => sum + s.amount, 0) || 0;

            if (pendingReceivable > 0) {
                return {
                    text: `You get ₹${pendingReceivable.toLocaleString('en-IN')}`,
                    badgeClass: 'bg-primary-fixed text-on-primary-fixed border border-primary/20',
                    icon: 'call_received',
                };
            } else if (split.settlements && split.settlements.length > 0) {
                return {
                    text: 'All dues received ✓',
                    badgeClass: 'bg-surface-container text-primary font-semibold',
                    icon: 'task_alt',
                };
            }
            return {
                text: 'You paid',
                badgeClass: 'bg-surface-container text-on-surface font-semibold',
                icon: 'check',
            };
        }

        const mySettlement = split.settlements?.find(
            (s) => s.from.toLowerCase() === activeUser.toLowerCase()
        );

        if (mySettlement) {
            if (mySettlement.status === 'PENDING') {
                return {
                    text: `You owe ₹${mySettlement.amount.toLocaleString('en-IN')}`,
                    subtext: `to ${mySettlement.to}`,
                    badgeClass: 'bg-tertiary-fixed text-on-tertiary-fixed font-bold border border-tertiary/20',
                    icon: 'priority_high',
                };
            } else {
                return {
                    text: 'You settled ✓',
                    badgeClass: 'bg-surface-container text-on-surface-variant font-medium',
                    icon: 'check_circle',
                };
            }
        }

        if (!isParticipant) {
            return null;
        }

        return null;
    };

    return (
        <div className="flex flex-col w-full pb-12 space-y-4">
            {/* Page Header */}
            <div className="flex items-center justify-between pt-1">
                <div>
                    <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline">
                        Money Splitter
                    </h1>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                        Group splits, settlement links, and contributions
                    </p>
                </div>
            </div>

            {/* Filter Toggle: ACTIVE vs SETTLED */}
            <div className="grid grid-cols-2 gap-2 bg-surface-container-low p-1 rounded-xl border border-outline-variant/30">
                <button
                    type="button"
                    onClick={() => setStatusFilter('ACTIVE')}
                    className={`h-9 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        statusFilter === 'ACTIVE'
                            ? 'bg-surface-container-lowest text-primary shadow-xs'
                            : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                >
                    Active Splits
                </button>
                <button
                    type="button"
                    onClick={() => setStatusFilter('SETTLED')}
                    className={`h-9 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        statusFilter === 'SETTLED'
                            ? 'bg-surface-container-lowest text-primary shadow-xs'
                            : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                >
                    Settled Splits
                </button>
            </div>

            {/* Splits List */}
            {isLoading ? (
                <div className="bg-surface-container-lowest p-8 rounded-2xl text-center text-xs text-on-surface-variant animate-pulse border border-outline-variant/30">
                    Loading splits from server...
                </div>
            ) : splits.length === 0 ? (
                <div className="bg-surface-container-lowest p-8 rounded-2xl text-center text-xs text-on-surface-variant border border-outline-variant/30 space-y-2">
                    <span className="material-symbols-outlined text-4xl text-outline-variant">
                        receipt_long
                    </span>
                    <p className="font-semibold text-sm text-on-surface">
                        No {statusFilter.toLowerCase()} splits found
                    </p>
                    <p>Create a new split anytime from the Add tab.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* Accordion Control Bar */}
                    <div className="flex items-center justify-between px-1">
                        <span className="text-xs text-on-surface-variant font-medium">
                            {splits.length} {splits.length === 1 ? 'split' : 'splits'} • Tap card to expand/shrink
                        </span>
                        <button
                            type="button"
                            onClick={() => toggleAll(!areAllExpanded)}
                            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-[16px]">
                                {areAllExpanded ? 'unfold_less' : 'unfold_more'}
                            </span>
                            <span>{areAllExpanded ? 'Collapse All' : 'Expand All'}</span>
                        </button>
                    </div>

                    {splits.map((split, index) => {
                        const totalSettlements = split.settlements?.length || 0;
                        const pendingSettlements =
                            split.settlements?.filter((s) => s.status === 'PENDING').length || 0;
                        const expanded = isExpanded(split.splitId, index);
                        const userStake = getUserSplitStake(split, activePerson);

                        return (
                            <div
                                key={split.splitId}
                                className={`bg-surface-container-lowest rounded-2xl border transition-all ${
                                    expanded
                                        ? 'p-4 border-outline-variant/40 space-y-3.5 shadow-sm'
                                        : 'p-3.5 border-outline-variant/30 hover:border-primary/40 hover:bg-surface-container-lowest/80 shadow-xs'
                                }`}
                            >
                                {/* Split Header / Accordion Trigger */}
                                <div
                                    onClick={() => toggleSplit(split.splitId, index)}
                                    className={`flex flex-col gap-2 cursor-pointer select-none transition-colors ${
                                        expanded ? 'pb-3 border-b border-outline-variant/20' : ''
                                    }`}
                                    role="button"
                                    aria-expanded={expanded}
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            toggleSplit(split.splitId, index);
                                        }
                                    }}
                                >
                                    {/* Top Row: Category + Status (Left) & Total Amount + Chevron (Right) */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-container text-primary">
                                                <span className="material-symbols-outlined text-[13px]">
                                                    {getCategoryIcon(split.category)}
                                                </span>
                                                <span className="truncate max-w-[120px]">{split.category}</span>
                                            </span>

                                            {/* Overall Split Status Badge */}
                                            {split.status === 'SETTLED' ? (
                                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant uppercase tracking-wider">
                                                    <span className="material-symbols-outlined text-[12px]">done_all</span>
                                                    <span>Settled</span>
                                                </span>
                                            ) : pendingSettlements === 0 ? (
                                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed uppercase tracking-wider">
                                                    <span className="material-symbols-outlined text-[12px]">check</span>
                                                    <span>All Paid</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant uppercase tracking-wider">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                                                    <span>{pendingSettlements} of {totalSettlements} due</span>
                                                </span>
                                            )}
                                        </div>

                                        {/* Total Amount & Chevron */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-lg sm:text-xl font-bold text-primary font-mono tracking-tight">
                                                ₹{split.totalAmount.toLocaleString('en-IN')}
                                            </span>
                                            <div className="w-7 h-7 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors shrink-0">
                                                <span
                                                    className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${
                                                        expanded ? 'rotate-180 text-primary' : ''
                                                    }`}
                                                >
                                                    keyboard_arrow_down
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Middle Row: Description */}
                                    <h3 className="font-bold text-base text-on-surface leading-snug break-words">
                                        {split.description}
                                    </h3>

                                    {/* Bottom Row: Metadata (Payer, participant count, date) & User Stake */}
                                    <div className="flex items-center justify-between gap-2 text-xs text-on-surface-variant flex-wrap pt-0.5">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span>
                                                Paid by <strong className="text-on-surface font-semibold">{split.paidBy}</strong>
                                            </span>
                                            {split.participants && (
                                                <>
                                                    <span className="opacity-40">•</span>
                                                    <span>{split.participants.length} {split.participants.length === 1 ? 'person' : 'people'}</span>
                                                </>
                                            )}
                                            {split.timestamp && (
                                                <>
                                                    <span className="opacity-40">•</span>
                                                    <span title={split.timestamp}>{formatDisplayDate(split.timestamp)}</span>
                                                </>
                                            )}
                                        </div>

                                        {/* User Stake at-a-glance */}
                                        {userStake && (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${userStake.badgeClass}`}>
                                                <span className="material-symbols-outlined text-[13px]">{userStake.icon}</span>
                                                <span>{userStake.text}</span>
                                                {userStake.subtext && <span className="opacity-75 font-normal ml-0.5">{userStake.subtext}</span>}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Accordion Collapsible Content */}
                                {expanded && (
                                    <div className="space-y-3.5 pt-1">
                                        {/* Split ID & Reference Bar (Only displayed in expanded view) */}
                                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="material-symbols-outlined text-primary text-[16px] shrink-0">
                                                    tag
                                                </span>
                                                <div className="min-w-0">
                                                    <span className="text-[10px] text-on-surface-variant uppercase font-semibold block leading-none mb-0.5">
                                                        Split Reference ID
                                                    </span>
                                                    <code className="text-xs font-mono font-bold text-on-surface truncate block">
                                                        {split.splitId}
                                                    </code>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCopyText(split.splitId, 'Split ID copied!');
                                                }}
                                                className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary hover:text-primary-container text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shrink-0 border border-outline-variant/20"
                                                title="Copy Split ID"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">content_copy</span>
                                                <span>Copy ID</span>
                                            </button>
                                        </div>

                                        {/* Participants List */}
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs text-on-surface-variant font-medium mr-1">
                                                Participants:
                                            </span>
                                            {split.participants.map((person) => (
                                                <div
                                                    key={person}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low text-xs border border-outline-variant/20"
                                                >
                                                    <Avatar name={person} size="sm" />
                                                    <span className="font-medium text-on-surface">
                                                        {person}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Contributions (if any) */}
                                        {split.contributions && split.contributions.length > 0 && (
                                            <div className="bg-surface-container-low/50 rounded-xl p-2.5 space-y-1.5 border border-outline-variant/20">
                                                <span className="text-[11px] font-semibold text-on-surface-variant block uppercase tracking-wider">
                                                    Recorded Partial Contributions
                                                </span>
                                                <div className="flex flex-wrap gap-2">
                                                    {split.contributions.map((c, i) => (
                                                        <span
                                                            key={i}
                                                            className="inline-flex items-center gap-1 text-xs bg-surface-container-lowest px-2 py-1 rounded-lg border border-outline-variant/20"
                                                        >
                                                            <span className="font-semibold text-on-surface">
                                                                {c.person}:
                                                            </span>
                                                            <span className="font-mono text-primary font-bold">
                                                                ₹{c.amount}
                                                            </span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Settlements Table */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-on-surface font-headline uppercase tracking-wider">
                                                    Settlements Breakdown
                                                </span>
                                                {split.status === 'ACTIVE' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedSplitForContribution(split);
                                                            setContributionPerson(split.participants[0] || '');
                                                        }}
                                                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <span className="material-symbols-outlined text-[15px]">
                                                            add
                                                        </span>
                                                        <span>Add Contribution</span>
                                                    </button>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                {split.settlements?.map((s) => {
                                                    const isPending = s.status === 'PENDING';
                                                    const isCreditor = s.to.toLowerCase() === activePerson.toLowerCase();
                                                    const isDebtor = s.from.toLowerCase() === activePerson.toLowerCase();

                                                    return (
                                                        <div
                                                            key={`${split.splitId}-settle-${s.from}-${s.to}-${s.amount}`}
                                                            className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-1.5"
                                                        >
                                                            {/* Row 1: Who owes who + status tag + amount */}
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    <span className="font-semibold text-xs text-on-surface truncate">
                                                                        {s.from} owes {s.to}
                                                                    </span>
                                                                    <span
                                                                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                                                                            isPending
                                                                                ? 'bg-tertiary-container text-on-tertiary-container'
                                                                                : 'bg-primary-fixed text-on-primary-fixed'
                                                                        }`}
                                                                    >
                                                                        {s.status}
                                                                    </span>
                                                                </div>
                                                                <span className="font-bold text-sm text-primary font-mono shrink-0">
                                                                    ₹{s.amount.toLocaleString('en-IN')}
                                                                </span>
                                                            </div>

                                                            {/* Row 2: UPI details & Action buttons (stacked cleanly, no collision!) */}
                                                            {(s.toUpiId || (isPending && (isDebtor || isCreditor || (!isDebtor && !isCreditor)))) && (
                                                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-outline-variant/15 text-[11px] flex-wrap">
                                                                    <span className="text-on-surface-variant font-mono truncate text-[11px]">
                                                                        {s.toUpiId ? `UPI: ${s.toUpiId}` : ''}
                                                                    </span>

                                                                    <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                                                                        {/* Debtor Action: Pay via UPI (Opens Payment Modal) */}
                                                                        {isPending && isDebtor && (s.upiIntent || s.toUpiId) && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    setPaymentSettlement({
                                                                                        to: s.to,
                                                                                        amount: s.amount,
                                                                                        toUpiId: s.toUpiId,
                                                                                        upiIntent: s.upiIntent,
                                                                                        appLinks: s.appLinks,
                                                                                        description: split.description,
                                                                                    })
                                                                                }
                                                                                className="h-7 px-2.5 rounded-lg bg-primary text-on-primary text-xs font-semibold flex items-center gap-1 shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
                                                                            >
                                                                                <span className="material-symbols-outlined text-[14px]">
                                                                                    bolt
                                                                                </span>
                                                                                <span>Pay</span>
                                                                            </button>
                                                                        )}

                                                                        {/* Debtor Status: Waiting for creditor confirmation */}
                                                                        {isPending && isDebtor && !isCreditor && !s.upiIntent && !s.toUpiId && (
                                                                            <span className="text-[10px] text-tertiary font-medium flex items-center gap-0.5">
                                                                                <span className="material-symbols-outlined text-[13px]">
                                                                                    hourglass_top
                                                                                </span>
                                                                                <span>Waiting for {s.to}</span>
                                                                            </span>
                                                                        )}

                                                                        {/* Creditor Action: ONLY the receiver (creditor) can confirm settlement */}
                                                                        {isPending && isCreditor && (
                                                                            <button
                                                                                type="button"
                                                                                disabled={settleMutation.isPending}
                                                                                onClick={() => handleSettle(split.splitId, s.from, s.to)}
                                                                                className="h-7 px-2.5 rounded-lg bg-primary-fixed text-on-primary-fixed hover:bg-primary hover:text-on-primary text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-50"
                                                                                title={`Confirm you have received ₹${s.amount} from ${s.from}`}
                                                                            >
                                                                                <span className="material-symbols-outlined text-[14px]">
                                                                                    done_all
                                                                                </span>
                                                                                <span>Confirm Received</span>
                                                                            </button>
                                                                        )}

                                                                        {/* Third Party Viewing */}
                                                                        {isPending && !isDebtor && !isCreditor && (
                                                                            <span className="text-[10px] text-on-surface-variant/80 italic">
                                                                                Owed to {s.to}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* WhatsApp Group Summary Section */}
                                        {split.notifications?.groupSummary && (
                                            <div className="pt-2 flex items-center justify-between gap-2 border-t border-outline-variant/20">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleShareWhatsapp(split.notifications?.groupSummary)
                                                    }
                                                    className="flex-1 h-9 rounded-xl bg-surface-container text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-container-high transition-colors cursor-pointer border border-outline-variant/20"
                                                >
                                                    <span className="material-symbols-outlined text-[#25D366] text-[18px]">
                                                        chat
                                                    </span>
                                                    <span>Share on WhatsApp</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleCopyText(split.notifications?.groupSummary)
                                                    }
                                                    className="h-9 px-3 rounded-xl bg-surface-container-low text-on-surface-variant hover:text-on-surface text-xs font-semibold flex items-center gap-1 cursor-pointer border border-outline-variant/20"
                                                    title="Copy Summary"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">
                                                        content_copy
                                                    </span>
                                                    <span>Copy</span>
                                                </button>
                                            </div>
                                        )}

                                        {/* Bottom Shrink Button */}
                                        <button
                                            type="button"
                                            onClick={() => toggleSplit(split.splitId, index)}
                                            className="w-full py-1 text-[11px] font-semibold text-on-surface-variant hover:text-primary flex items-center justify-center gap-1 cursor-pointer transition-colors border-t border-outline-variant/15 pt-1.5"
                                        >
                                            <span className="material-symbols-outlined text-[15px]">
                                                keyboard_arrow_up
                                            </span>
                                            <span>Collapse card</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add Contribution Modal */}
            {selectedSplitForContribution && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
                    <div className="bg-surface-container-lowest rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-outline-variant/30 space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
                            <div>
                                <h3 className="font-bold text-base text-on-surface">
                                    Add Contribution
                                </h3>
                                <p className="text-xs text-on-surface-variant">
                                    {selectedSplitForContribution.description}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedSplitForContribution(null)}
                                className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[16px]">
                                    close
                                </span>
                            </button>
                        </div>

                        <form onSubmit={handleAddContribution} className="space-y-3.5">
                            <div>
                                <label htmlFor="contribute-person-select" className="text-xs font-semibold text-on-surface-variant block mb-1">
                                    Contributing Person
                                </label>
                                <select
                                    id="contribute-person-select"
                                    value={contributionPerson}
                                    onChange={(e) => setContributionPerson(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-sm font-semibold text-on-surface border border-outline-variant/30 focus:outline-none"
                                >
                                    {selectedSplitForContribution.participants.map((p) => (
                                        <option key={p} value={p}>
                                            {p}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="contribute-amount-input" className="text-xs font-semibold text-on-surface-variant block mb-1">
                                    Amount (₹)
                                </label>
                                <input
                                    id="contribute-amount-input"
                                    type="number"
                                    min="1"
                                    value={contributionAmount}
                                    onChange={(e) => setContributionAmount(e.target.value)}
                                    placeholder="Enter amount"
                                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-sm font-mono font-bold text-on-surface border border-outline-variant/30 focus:outline-none"
                                    required
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedSplitForContribution(null)}
                                    className="flex-1 h-10 rounded-xl bg-surface-container text-on-surface-variant text-xs font-semibold cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={contributeMutation.isPending}
                                    className="flex-1 h-10 rounded-xl bg-primary text-on-primary text-xs font-semibold shadow-xs hover:bg-primary-container cursor-pointer"
                                >
                                    {contributeMutation.isPending ? 'Saving...' : 'Submit'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Payment App / UPI Intent Modal */}
            <PaymentModal
                isOpen={!!paymentSettlement}
                onClose={() => setPaymentSettlement(null)}
                settlement={paymentSettlement}
            />
        </div>
    );
}

export default SplitsPage;
