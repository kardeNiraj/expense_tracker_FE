import React from 'react';
import type { AnalyticsMonthlyPoint } from '../../../api/types';
import { triggerHaptic } from '../../../utils/haptics';

interface MonthlyTrendCardProps {
    monthlyTrend: AnalyticsMonthlyPoint[];
    selectedMonth: string;
    onSelectMonth: (month: string) => void;
}

export const MonthlyTrendCard: React.FC<MonthlyTrendCardProps> = ({
    monthlyTrend,
    selectedMonth,
    onSelectMonth,
}) => {
    if (monthlyTrend.length === 0) return null;

    const maxTotal = Math.max(1, ...monthlyTrend.map((m) => m.total));

    return (
        <section className="bg-surface-card p-4 rounded-2xl border border-border-subtle shadow-[0_1px_3px_rgba(15,23,42,0.05)] space-y-3">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h2 className="text-[20px] leading-[28px] font-semibold text-on-surface font-headline">
                        Monthly Spend Comparison
                    </h2>
                    <p className="text-xs text-on-surface-variant">
                        Tap a month to inspect its categories and daily burn
                    </p>
                </div>
                {selectedMonth !== 'ALL' && (
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic('light');
                            onSelectMonth('ALL');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-surface-card-subtle text-[11px] font-semibold text-primary hover:bg-surface-container cursor-pointer shrink-0 border border-border-subtle"
                    >
                        All Months
                    </button>
                )}
            </div>

            <div className="space-y-2.5">
                {monthlyTrend.map((m) => {
                    const totalPct = Math.max(4, Math.round((m.total / maxTotal) * 100));
                    const splitPct = m.total > 0 ? Math.round((m.splitAmount / m.total) * 100) : 0;
                    const directPct = m.total > 0 ? 100 - splitPct : 0;
                    const isSelected = selectedMonth.toLowerCase() === m.month.toLowerCase();

                    return (
                        <button
                            key={m.month}
                            type="button"
                            onClick={() => {
                                triggerHaptic('light');
                                onSelectMonth(isSelected ? 'ALL' : m.month);
                            }}
                            className={`w-full text-left p-3 rounded-xl border transition-[border-color,background-color] cursor-pointer ${
                                isSelected
                                    ? 'bg-primary/5 border-primary/50 shadow-2xs'
                                    : 'bg-surface-card-subtle/60 border-border-subtle hover:border-border-strong'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-sm font-bold text-on-surface truncate">
                                            {m.month}
                                        </span>
                                        {m.topCategory && (
                                            <span className="px-1.5 py-0.5 rounded-sm bg-surface-card border border-border-subtle text-[10px] font-semibold font-mono text-on-surface-variant">
                                                Top: {m.topCategory}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[11px] text-on-surface-variant block mt-0.5 tabular-nums">
                                        {m.count} {m.count === 1 ? 'item' : 'items'} · Direct ₹
                                        {m.directAmount.toLocaleString('en-IN')} · Splits ₹
                                        {m.splitAmount.toLocaleString('en-IN')}
                                    </span>
                                </div>

                                <span className="text-sm font-semibold text-on-surface font-mono tabular-nums shrink-0">
                                    ₹{m.total.toLocaleString('en-IN')}
                                </span>
                            </div>

                            {/* Stacked Horizontal Month Bar */}
                            <div className="w-full h-2 bg-border-subtle/70 rounded-full overflow-hidden">
                                <div
                                    className="h-full flex rounded-full overflow-hidden transition-[width] duration-300"
                                    style={{ width: `${totalPct}%` }}
                                >
                                    {splitPct > 0 && (
                                        <div
                                            className="h-full bg-[#065f46]"
                                            style={{ width: `${splitPct}%` }}
                                        />
                                    )}
                                    {directPct > 0 && (
                                        <div
                                            className="h-full bg-[#0284c7]"
                                            style={{ width: `${directPct}%` }}
                                        />
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center justify-center gap-4 text-[11px] text-on-surface-variant pt-0.5">
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#065f46]" />
                    Split Share
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#0284c7]" />
                    Direct Personal
                </span>
            </div>
        </section>
    );
};

export default MonthlyTrendCard;
