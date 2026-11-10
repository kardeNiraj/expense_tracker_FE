import React, { useId, useMemo, useState } from 'react';
import type { AnalyticsTransaction } from '../../../api/types';
import { formatPurchaseTime, getCategoryMeta } from '../../../utils/formatters';
import { triggerHaptic } from '../../../utils/haptics';

interface BreakdownLedgerCardProps {
    transactions: AnalyticsTransaction[];
    selectedCategory: string | null;
    onClearCategory: () => void;
}

export const BreakdownLedgerCard: React.FC<BreakdownLedgerCardProps> = ({
    transactions,
    selectedCategory,
    onClearCategory,
}) => {
    const searchInputId = useId();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategoryKey, setExpandedCategoryKey] = useState<string | null>(null);

    const isShowAll =
        expandedCategoryKey === (selectedCategory ? `cat:${selectedCategory}` : 'all');

    const filteredTransactions = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return transactions.filter((tx) => {
            if (
                selectedCategory &&
                tx.category.toLowerCase() !== selectedCategory.toLowerCase()
            ) {
                return false;
            }
            if (!q) return true;
            return (
                tx.description.toLowerCase().includes(q) ||
                tx.category.toLowerCase().includes(q) ||
                tx.paidBy.toLowerCase().includes(q)
            );
        });
    }, [transactions, selectedCategory, searchQuery]);

    const visibleTransactions = isShowAll
        ? filteredTransactions
        : filteredTransactions.slice(0, 12);

    const toggleShowAll = () => {
        triggerHaptic('light');
        const currentKey = selectedCategory ? `cat:${selectedCategory}` : 'all';
        setExpandedCategoryKey((prev) => (prev === currentKey ? null : currentKey));
    };

    return (
        <section className="bg-surface-card p-4 rounded-2xl border border-border-subtle shadow-[0_1px_3px_rgba(15,23,42,0.05)] space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h2 className="headline-md text-on-surface">
                        {selectedCategory ? `${selectedCategory} Expenses` : 'Breakdown Ledger'}
                    </h2>
                    <p className="text-xs font-medium text-on-surface-variant tabular-nums">
                        {filteredTransactions.length}{' '}
                        {filteredTransactions.length === 1 ? 'transaction' : 'transactions'} matching
                        filters
                    </p>
                </div>

                {selectedCategory && (
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic('light');
                            onClearCategory();
                        }}
                        className="px-2.5 py-1 rounded-full bg-status-settled-bg text-status-settled-text label-pill uppercase flex items-center gap-1 cursor-pointer shrink-0"
                    >
                        <span>{selectedCategory}</span>
                        <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                )}
            </div>

            {/* Accessible Search Bar */}
            <div className="relative">
                <label htmlFor={searchInputId} className="sr-only">
                    Search transactions by description, category, or payer
                </label>
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    search
                </span>
                <input
                    id={searchInputId}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search description, category, or payer..."
                    className="w-full h-10 pl-9 pr-8 rounded-xl bg-surface-card-subtle text-xs text-on-surface border border-border-strong focus:outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {searchQuery && (
                    <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface cursor-pointer"
                        aria-label="Clear search"
                    >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                )}
            </div>

            {filteredTransactions.length === 0 ? (
                <div className="py-6 text-center text-xs text-on-surface-variant bg-surface-card-subtle/60 rounded-xl border border-dashed border-border-strong">
                    No matching transactions found.
                </div>
            ) : (
                <div className="space-y-2">
                    {visibleTransactions.map((tx) => {
                        const meta = getCategoryMeta(tx.category);
                        const timeInfo = formatPurchaseTime(tx.timestamp || undefined);

                        return (
                            <div
                                key={tx.id}
                                className="p-3 rounded-xl bg-surface-card-subtle/60 border border-border-subtle space-y-1.5"
                            >
                                <div className="flex items-start justify-between gap-2.5">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                        <div
                                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${meta.bgClass} ${meta.textClass}`}
                                        >
                                            <span className="material-symbols-outlined text-[17px]">
                                                {meta.icon}
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-on-surface truncate">
                                                {tx.description}
                                            </p>
                                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                                <span className="text-xs font-medium text-on-surface-variant">
                                                    {tx.category}
                                                </span>
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.05em] font-mono ${
                                                        tx.isSplit
                                                            ? 'bg-status-settled-bg text-status-settled-text'
                                                            : 'bg-status-awaiting-bg text-status-awaiting-text'
                                                    }`}
                                                >
                                                    {tx.isSplit ? 'Split Share' : 'Direct'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <span className="label-currency text-on-surface tabular-nums block">
                                            ₹{tx.amount.toLocaleString('en-IN')}
                                        </span>
                                        {tx.isSplit && tx.totalBill > tx.amount && (
                                            <span className="text-[11px] text-on-surface-variant font-mono tabular-nums">
                                                of ₹{tx.totalBill.toLocaleString('en-IN')}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-1.5 border-t border-border-subtle flex items-center justify-between text-xs text-on-surface-variant">
                                    <span className="truncate font-medium">
                                        Paid by {tx.paidBy}
                                    </span>
                                    {timeInfo.full && (
                                        <span className="font-mono text-[11px] tabular-nums shrink-0">
                                            {timeInfo.full}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {filteredTransactions.length > 12 && (
                        <button
                            type="button"
                            onClick={toggleShowAll}
                            className="w-full py-2.5 rounded-xl bg-surface-card-subtle hover:bg-surface-container border border-border-subtle text-xs font-semibold text-primary cursor-pointer transition-colors"
                        >
                            {isShowAll
                                ? 'Show Fewer'
                                : `Show All ${filteredTransactions.length} Transactions`}
                        </button>
                    )}
                </div>
            )}
        </section>
    );
};

export default BreakdownLedgerCard;

