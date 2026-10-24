import React, { useState } from 'react';
import { useExpense } from '../../context';
import {
    useSplits,
    useSettleParticipantMutation,
    useAddContributionMutation,
} from '../../api';
import { Avatar } from '../../components';
import type { Split } from '../../api/types';

export function SplitsPage() {
    const { activePerson, showToast } = useExpense();
    const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'SETTLED'>('ACTIVE');
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
            await settleMutation.mutateAsync({ splitId, from: fromPerson, to: toPerson });
            showToast(
                toPerson
                    ? `Settlement marked complete for ${fromPerson} to ${toPerson}!`
                    : `Settlement marked complete for ${fromPerson}!`
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

    const handleCopyText = (text?: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        showToast('Summary copied to clipboard!', 'content_copy');
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
                                    className={`flex items-start justify-between gap-3 cursor-pointer select-none transition-colors ${
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
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-container text-primary">
                                                {split.category}
                                            </span>
                                            <span className="text-[11px] text-on-surface-variant font-mono">
                                                {split.splitId}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-base text-on-surface truncate mt-1">
                                            {split.description}
                                        </h3>
                                        <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                                            Paid by <strong className="text-on-surface">{split.paidBy}</strong>
                                            {split.participants ? ` • ${split.participants.length} people` : ''}
                                            {split.timestamp ? ` • ${split.timestamp}` : ''}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="text-right">
                                            <span className="text-xl font-bold text-primary font-mono block">
                                                ₹{split.totalAmount.toLocaleString('en-IN')}
                                            </span>
                                            <span
                                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                                    split.status === 'ACTIVE'
                                                        ? 'bg-secondary-fixed text-on-secondary-fixed-variant'
                                                        : 'bg-surface-container text-on-surface-variant'
                                                }`}
                                            >
                                                {split.status} ({pendingSettlements} of {totalSettlements} due)
                                            </span>
                                        </div>

                                        <div className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors shrink-0">
                                            <span
                                                className={`material-symbols-outlined text-[20px] transition-transform duration-200 ${
                                                    expanded ? 'rotate-180 text-primary' : ''
                                                }`}
                                            >
                                                keyboard_arrow_down
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Accordion Collapsible Content */}
                                {expanded && (
                                    <div className="space-y-3.5 pt-0.5">
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
                                                {split.settlements?.map((s, idx) => {
                                                    const isPending = s.status === 'PENDING';
                                                    const isYouPaying = s.from.toLowerCase() === activePerson.toLowerCase();

                                                    return (
                                                        <div
                                                            key={`${s.from}-${s.to}-${s.amount}-${idx}`}
                                                            className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 gap-2"
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-semibold text-xs text-on-surface truncate">
                                                                        {s.from} owes {s.to}
                                                                    </span>
                                                                    <span
                                                                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                                                            isPending
                                                                                ? 'bg-tertiary-container text-on-tertiary-container'
                                                                                : 'bg-primary-fixed text-on-primary-fixed'
                                                                        }`}
                                                                    >
                                                                        {s.status}
                                                                    </span>
                                                                </div>
                                                                {s.toUpiId && (
                                                                    <span className="text-[11px] text-on-surface-variant font-mono truncate block">
                                                                        UPI: {s.toUpiId}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="font-bold text-sm text-primary font-mono">
                                                                    ₹{s.amount.toLocaleString('en-IN')}
                                                                </span>

                                                                {isPending && s.upiIntent && isYouPaying && (
                                                                    <a
                                                                        href={s.upiIntent}
                                                                        onClick={() =>
                                                                            showToast(
                                                                                `Launching UPI to pay ₹${s.amount}...`,
                                                                                'bolt'
                                                                            )
                                                                        }
                                                                        className="h-7 px-2 rounded-lg bg-primary text-on-primary text-xs font-semibold flex items-center gap-0.5 shadow-xs hover:bg-primary-container"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[14px]">
                                                                            bolt
                                                                        </span>
                                                                        <span>UPI</span>
                                                                    </a>
                                                                )}

                                                                {isPending && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSettle(split.splitId, s.from, s.to)}
                                                                        className="h-7 px-2 rounded-lg bg-surface-container-high text-primary hover:bg-primary hover:text-on-primary text-xs font-semibold transition-colors cursor-pointer"
                                                                    >
                                                                        Mark Settled
                                                                    </button>
                                                                )}
                                                            </div>
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
        </div>
    );
}

export default SplitsPage;
