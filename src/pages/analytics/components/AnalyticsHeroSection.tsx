import React from 'react';
import { AppIcon } from '../../../components';
import type { AnalyticsSummary } from '../../../api/types';

interface AnalyticsHeroSectionProps {
    summary: AnalyticsSummary;
    isGroupView: boolean;
}

export const AnalyticsHeroSection: React.FC<AnalyticsHeroSectionProps> = ({
    summary,
    isGroupView,
}) => {
    const momDelta = summary.monthOverMonthDeltaPct;
    const isMomDown = momDelta !== null && momDelta <= 0;

    return (
        <div className="space-y-4">
            {/* 1. Hero Spend Card */}
            <div className="relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-[#004532] via-[#065f46] to-[#0f766e] text-white shadow-md">
                <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                <div className="absolute -left-8 -bottom-10 w-32 h-32 rounded-full bg-[#99efe5]/15 blur-2xl pointer-events-none" />

                <div className="relative z-10 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <span className="label-pill uppercase text-white/85">
                            {isGroupView ? 'Total Group Spend' : 'True Personal Spend'}
                        </span>

                        {momDelta !== null && (
                            <span
                                className={`px-2.5 py-0.5 rounded-full label-pill uppercase tabular-nums inline-flex items-center gap-1 ${
                                    isMomDown
                                        ? 'bg-status-settled-bg text-status-settled-text'
                                        : 'bg-status-pending-bg text-status-pending-text'
                                }`}
                            >
                                <AppIcon
                                    name={isMomDown ? 'trending_down' : 'trending_up'}
                                    className="text-[12px]"
                                />
                                {Math.abs(momDelta)}% MoM
                            </span>
                        )}
                    </div>

                    <div className="flex items-baseline justify-between gap-2">
                        <p className="display-currency-mobile sm:text-[36px] sm:leading-[44px] tracking-tight tabular-nums text-white">
                            ₹{summary.trueSpend.toLocaleString('en-IN')}
                        </p>
                        <span className="text-xs text-white/85 font-mono tabular-nums shrink-0">
                            {summary.totalTransactions}{' '}
                            {summary.totalTransactions === 1 ? 'expense' : 'expenses'}
                        </span>
                    </div>

                    {/* Direct / Split / Upfront Breakdown Pills */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                        <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xs">
                            <span className="text-[10px] uppercase tracking-[0.05em] text-white/80 font-mono block">
                                Direct
                            </span>
                            <span className="text-xs sm:text-sm font-semibold font-mono tabular-nums">
                                ₹{Math.round(summary.directSpend).toLocaleString('en-IN')}
                            </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xs">
                            <span className="text-[10px] uppercase tracking-[0.05em] text-white/80 font-mono block">
                                Split Share
                            </span>
                            <span className="text-xs sm:text-sm font-semibold font-mono tabular-nums">
                                ₹{Math.round(summary.splitShareSpend).toLocaleString('en-IN')}
                            </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xs">
                            <span className="text-[10px] uppercase tracking-[0.05em] text-white/80 font-mono block">
                                Paid Upfront
                            </span>
                            <span className="text-xs sm:text-sm font-semibold font-mono tabular-nums">
                                ₹{Math.round(summary.outOfPocketPaid).toLocaleString('en-IN')}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. 2x2 KPI Bento Grid (Level 1 Surface Cards) */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-card p-3.5 rounded-2xl border border-border-subtle shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
                    <span className="label-pill uppercase text-on-surface-variant block">
                        Daily Burn Avg
                    </span>
                    <p className="text-lg font-bold text-on-surface font-mono tabular-nums mt-1">
                        ₹{Math.round(summary.avgDailySpend).toLocaleString('en-IN')}
                    </p>
                    <span className="text-xs font-medium text-on-surface-variant block mt-0.5 tabular-nums">
                        Across {summary.activeDaysCount} active{' '}
                        {summary.activeDaysCount === 1 ? 'day' : 'days'}
                    </span>
                </div>

                <div className="bg-surface-card p-3.5 rounded-2xl border border-border-subtle shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
                    <span className="label-pill uppercase text-on-surface-variant block">
                        Avg Per Expense
                    </span>
                    <p className="text-lg font-bold text-on-surface font-mono tabular-nums mt-1">
                        ₹{Math.round(summary.avgTransaction).toLocaleString('en-IN')}
                    </p>
                    <span className="text-xs font-medium text-on-surface-variant block mt-0.5 tabular-nums">
                        {summary.directCount} direct · {summary.splitCount} splits
                    </span>
                </div>

                <div className="bg-surface-card p-3.5 rounded-2xl border border-border-subtle shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
                    <span className="label-pill uppercase text-on-surface-variant block">
                        This Month Pace
                    </span>
                    <p className="text-lg font-bold text-primary font-mono tabular-nums mt-1">
                        ₹{Math.round(summary.currentMonthSpend).toLocaleString('en-IN')}
                    </p>
                    <span className="text-xs font-medium text-on-surface-variant block mt-0.5 truncate tabular-nums">
                        {summary.projectedMonthEndSpend > 0
                            ? `Est. ₹${Math.round(
                                  summary.projectedMonthEndSpend
                              ).toLocaleString('en-IN')} / mo`
                            : `Today: ₹${summary.todaySpend.toLocaleString('en-IN')}`}
                    </span>
                </div>

                <div className="bg-surface-card p-3.5 rounded-2xl border border-border-subtle shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
                    <span className="label-pill uppercase text-on-surface-variant block">
                        Biggest Expense
                    </span>
                    <p className="text-lg font-bold text-tertiary font-mono tabular-nums mt-1">
                        ₹
                        {summary.largestExpense
                            ? Math.round(summary.largestExpense.amount).toLocaleString('en-IN')
                            : '0'}
                    </p>
                    <span className="text-xs font-medium text-on-surface-variant block mt-0.5 truncate">
                        {summary.largestExpense
                            ? summary.largestExpense.description
                            : 'No expenses yet'}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsHeroSection;

