import React from 'react';
import type { AnalyticsDayOfWeekPoint } from '../../../api/types';

interface SpendingHabitsCardProps {
    directSpend: number;
    splitShareSpend: number;
    outOfPocketPaid: number;
    trueSpend: number;
    dayOfWeek: AnalyticsDayOfWeekPoint[];
    isGroupView: boolean;
}

export const SpendingHabitsCard: React.FC<SpendingHabitsCardProps> = ({
    directSpend,
    splitShareSpend,
    outOfPocketPaid,
    trueSpend,
    dayOfWeek,
    isGroupView,
}) => {
    const splitPct = trueSpend > 0 ? Math.round((splitShareSpend / trueSpend) * 100) : 0;
    const directPct = trueSpend > 0 ? 100 - splitPct : 0;

    const maxDowAmount = Math.max(1, ...dayOfWeek.map((d) => d.amount));
    const peakDay = dayOfWeek.reduce(
        (best, curr) => (curr.amount > best.amount ? curr : best),
        dayOfWeek[0] || {
            day: 'Mon',
            amount: 0,
            count: 0,
            dayIndex: 0,
            isWeekend: false,
            avgAmount: 0,
        }
    );

    const weekendTotal = dayOfWeek
        .filter((d) => d.isWeekend)
        .reduce((sum, d) => sum + d.amount, 0);
    const weekdayTotal = dayOfWeek
        .filter((d) => !d.isWeekend)
        .reduce((sum, d) => sum + d.amount, 0);
    const weekendShare =
        weekendTotal + weekdayTotal > 0
            ? Math.round((weekendTotal / (weekendTotal + weekdayTotal)) * 100)
            : 0;

    const cashflowDiff = Math.round((outOfPocketPaid - trueSpend) * 100) / 100;

    return (
        <section className="bg-surface-card p-4 rounded-2xl border border-border-subtle shadow-[0_1px_3px_rgba(15,23,42,0.05)] space-y-4">
            <div>
                <h2 className="text-[20px] leading-[28px] font-semibold text-on-surface font-headline">
                    Spending Mix &amp; Habits
                </h2>
                <p className="text-xs text-on-surface-variant">
                    Solo vs. shared split ratio &amp; weekly spending rhythm
                </p>
            </div>

            {/* 1. Direct vs Split Ratio */}
            <div className="p-3 rounded-xl bg-surface-card-subtle/70 border border-border-subtle space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-primary tabular-nums">
                        Shared Splits ({splitPct}%)
                    </span>
                    <span className="font-semibold text-[#0369a1] tabular-nums">
                        Direct Solo ({directPct}%)
                    </span>
                </div>
                <div className="w-full h-3 bg-border-subtle/70 rounded-full overflow-hidden flex">
                    {splitPct > 0 && (
                        <div
                            className="h-full bg-[#065f46] transition-[width] duration-300"
                            style={{ width: `${splitPct}%` }}
                        />
                    )}
                    {directPct > 0 && (
                        <div
                            className="h-full bg-[#0284c7] transition-[width] duration-300"
                            style={{ width: `${directPct}%` }}
                        />
                    )}
                </div>
                <div className="flex items-center justify-between text-xs font-mono font-semibold tabular-nums text-on-surface-variant">
                    <span>₹{splitShareSpend.toLocaleString('en-IN')}</span>
                    <span>₹{directSpend.toLocaleString('en-IN')}</span>
                </div>
            </div>

            {/* 2. Upfront Paid vs Consumed Comparison (Individual View) */}
            {!isGroupView && (
                <div className="p-3 rounded-xl bg-surface-card-subtle/70 border border-border-subtle flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant font-mono block">
                            Paid Upfront vs True Share
                        </span>
                        <p className="text-xs text-on-surface mt-0.5 tabular-nums">
                            Paid ₹{outOfPocketPaid.toLocaleString('en-IN')} for ₹
                            {trueSpend.toLocaleString('en-IN')} personal share
                        </p>
                    </div>
                    <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold font-mono tabular-nums shrink-0 ${
                            cashflowDiff > 0
                                ? 'bg-status-settled-bg text-status-settled-text'
                                : cashflowDiff < 0
                                  ? 'bg-error-container text-negative'
                                  : 'bg-surface-card text-on-surface-variant border border-border-subtle'
                        }`}
                    >
                        {cashflowDiff > 0
                            ? `+₹${cashflowDiff.toLocaleString('en-IN')}`
                            : cashflowDiff < 0
                              ? `-₹${Math.abs(cashflowDiff).toLocaleString('en-IN')}`
                              : 'Balanced'}
                    </span>
                </div>
            )}

            {/* 3. Day-of-Week Bars */}
            <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-on-surface">Spend by Day of Week</span>
                    {weekendTotal + weekdayTotal > 0 && (
                        <span className="text-[11px] font-mono font-semibold tabular-nums text-status-pending-text bg-status-pending-bg px-2 py-0.5 rounded-full">
                            {weekendShare}% on Sat–Sun
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-7 gap-1.5 items-end pt-2">
                    {dayOfWeek.map((d) => {
                        const heightPct =
                            d.amount > 0
                                ? Math.max(12, Math.round((d.amount / maxDowAmount) * 100))
                                : 4;
                        const isPeak = peakDay && peakDay.day === d.day && d.amount > 0;

                        return (
                            <div
                                key={d.day}
                                className="flex flex-col items-center gap-1.5"
                                title={`${d.day}: ₹${d.amount.toLocaleString('en-IN')} (${d.count} items)`}
                            >
                                <span className="text-[10px] font-mono tabular-nums text-on-surface-variant h-3 flex items-center">
                                    {d.amount > 0
                                        ? d.amount >= 1000
                                            ? `${(d.amount / 1000).toFixed(1)}k`
                                            : `${Math.round(d.amount)}`
                                        : '0'}
                                </span>
                                <div className="w-full h-20 bg-surface-card-subtle rounded-lg flex items-end p-0.5 border border-border-subtle">
                                    <div
                                        className={`w-full rounded-md transition-[height] duration-300 ${
                                            isPeak
                                                ? 'bg-tertiary'
                                                : d.isWeekend
                                                  ? 'bg-secondary'
                                                  : d.amount > 0
                                                    ? 'bg-primary'
                                                    : 'bg-border-strong/50'
                                        }`}
                                        style={{ height: `${heightPct}%` }}
                                    />
                                </div>
                                <span
                                    className={`text-[11px] font-mono ${
                                        isPeak
                                            ? 'font-bold text-tertiary'
                                            : d.isWeekend
                                              ? 'font-semibold text-secondary'
                                              : 'text-on-surface-variant'
                                    }`}
                                >
                                    {d.day}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default SpendingHabitsCard;
