import React, { useState, useMemo } from 'react';
import type { AnalyticsDailyPoint } from '../../../api/types';
import { triggerHaptic } from '../../../utils/haptics';
import { DailyBarsSvg, CumulativeAreaSvg } from './DailyTrendSvgCharts';
import { buildCumulativePath, buildDailyAxisLabels } from './dailyTrendUtils';

interface DailyTrendCardProps {
    dailyTrend: AnalyticsDailyPoint[];
    avgDailySpend: number;
}

export const DailyTrendCard: React.FC<DailyTrendCardProps> = ({
    dailyTrend,
    avgDailySpend,
}) => {
    const [mode, setMode] = useState<'daily' | 'cumulative'>('daily');
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    const peakPoint = useMemo(() => {
        if (dailyTrend.length === 0) return null;
        return dailyTrend.reduce(
            (best, curr) => (curr.amount > best.amount ? curr : best),
            dailyTrend[0]
        );
    }, [dailyTrend]);

    const activePoint = useMemo(() => {
        if (dailyTrend.length === 0) return null;
        if (selectedDate) {
            const found = dailyTrend.find((d) => d.date === selectedDate);
            if (found) return found;
        }
        return peakPoint || dailyTrend[dailyTrend.length - 1];
    }, [dailyTrend, selectedDate, peakPoint]);

    const maxValue = useMemo(() => {
        if (dailyTrend.length === 0) return 100;
        if (mode === 'cumulative') {
            return Math.max(100, ...dailyTrend.map((d) => d.cumulativeAmount));
        }
        return Math.max(100, avgDailySpend, ...dailyTrend.map((d) => d.amount));
    }, [dailyTrend, mode, avgDailySpend]);

    const linePath = useMemo(
        () => buildCumulativePath(dailyTrend, mode, maxValue),
        [dailyTrend, mode, maxValue]
    );

    const axisLabels = useMemo(() => buildDailyAxisLabels(dailyTrend), [dailyTrend]);

    return (
        <section className="bg-surface-card p-4 rounded-2xl border border-border-subtle shadow-[0_1px_3px_rgba(15,23,42,0.05)] space-y-3">
            {/* Header & Mode Switch */}
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h2 className="headline-md text-on-surface">Spending Timeline</h2>
                    <p className="text-xs text-on-surface-variant">
                        {mode === 'daily'
                            ? 'Daily spend spikes vs active-day average'
                            : 'Cumulative cash outflow over time'}
                    </p>
                </div>

                <div className="flex items-center bg-surface-card-subtle p-0.5 rounded-xl border border-border-subtle shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic('light');
                            setMode('daily');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                            mode === 'daily'
                                ? 'bg-primary text-on-primary shadow-2xs'
                                : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                    >
                        Daily
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic('light');
                            setMode('cumulative');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                            mode === 'cumulative'
                                ? 'bg-secondary text-on-secondary shadow-2xs'
                                : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                    >
                        Cumulative
                    </button>
                </div>
            </div>

            {dailyTrend.length === 0 ? (
                <div className="py-8 text-center text-xs text-on-surface-variant bg-surface-card-subtle/60 rounded-xl border border-dashed border-border-strong">
                    No dated transactions available for a timeline yet.
                </div>
            ) : (
                <>
                    {activePoint && (
                        <div className="px-3 py-2 rounded-xl bg-surface-card-subtle border border-border-subtle flex items-center justify-between gap-2 text-xs">
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-on-surface">
                                        {activePoint.label}
                                    </span>
                                    {peakPoint?.date === activePoint.date &&
                                        activePoint.amount > 0 && (
                                            <span className="px-1.5 py-0.2 rounded-sm bg-status-pending-bg text-status-pending-text text-[10px] font-semibold uppercase tracking-[0.05em] font-mono">
                                                Peak
                                            </span>
                                        )}
                                </div>
                                <span className="text-[11px] text-on-surface-variant block truncate tabular-nums">
                                    {activePoint.count} {activePoint.count === 1 ? 'tx' : 'txs'} ·
                                    Direct ₹{activePoint.directAmount.toLocaleString('en-IN')} ·
                                    Split ₹{activePoint.splitAmount.toLocaleString('en-IN')}
                                </span>
                            </div>

                            <div className="text-right shrink-0">
                                <span className="font-semibold text-primary font-mono tabular-nums text-sm block">
                                    ₹
                                    {(mode === 'daily'
                                        ? activePoint.amount
                                        : activePoint.cumulativeAmount
                                    ).toLocaleString('en-IN')}
                                </span>
                                <span className="text-[11px] text-on-surface-variant font-mono tabular-nums">
                                    {mode === 'daily'
                                        ? `Cum. ₹${activePoint.cumulativeAmount.toLocaleString('en-IN')}`
                                        : `Day ₹${activePoint.amount.toLocaleString('en-IN')}`}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="w-full overflow-hidden">
                        {mode === 'daily' ? (
                            <DailyBarsSvg
                                dailyTrend={dailyTrend}
                                avgDailySpend={avgDailySpend}
                                maxValue={maxValue}
                                selectedDate={selectedDate}
                                activeDate={activePoint?.date}
                                axisLabels={axisLabels}
                                onSelectDate={setSelectedDate}
                            />
                        ) : (
                            <CumulativeAreaSvg
                                totalDays={dailyTrend.length}
                                path={linePath.path}
                                area={linePath.area}
                                points={linePath.points}
                                activeDate={activePoint?.date}
                                axisLabels={axisLabels}
                                onSelectDate={setSelectedDate}
                            />
                        )}
                    </div>

                    {mode === 'daily' && (
                        <div className="flex items-center justify-center gap-4 text-[11px] text-on-surface-variant">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-xs bg-[#065f46]" />
                                Split Share
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-xs bg-[#0284c7]" />
                                Direct Personal
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 border-t border-dashed border-[#d97706]" />
                                Active-Day Avg
                            </span>
                        </div>
                    )}
                </>
            )}
        </section>
    );
};

export default DailyTrendCard;
