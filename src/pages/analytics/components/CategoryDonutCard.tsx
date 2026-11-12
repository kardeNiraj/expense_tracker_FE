import React, { useState, useMemo } from 'react';
import type { AnalyticsCategoryStat } from '../../../api/types';
import { getCategoryMeta } from '../../../utils/formatters';
import { triggerHaptic } from '../../../utils/haptics';
import { AppIcon } from '../../../components';

// Strictly derived from DESIGN.md Section 2.1 & 2.3 Brand & Status Palette
const CATEGORY_COLORS = [
    '#065f46', // Primary Emerald Deep
    '#0f766e', // Secondary Slate Teal
    '#d97706', // Tertiary Warm Amber
    '#0369a1', // Awaiting Sky Blue
    '#6b21a8', // Partially Paid Purple
    '#be123c', // Negative Crimson Rose
    '#1e293b', // Dark Slate
    '#15803d', // Settled Emerald
];

interface CategoryDonutCardProps {
    categories: AnalyticsCategoryStat[];
    selectedCategory: string | null;
    onSelectCategory: (category: string | null) => void;
    isGroupView: boolean;
}

export const CategoryDonutCard: React.FC<CategoryDonutCardProps> = ({
    categories,
    selectedCategory,
    onSelectCategory,
    isGroupView,
}) => {
    const [metricMode, setMetricMode] = useState<'share' | 'upfront'>('share');

    const chartItems = useMemo(() => {
        const items = categories
            .map((cat, idx) => {
                const value = metricMode === 'share' ? cat.amount : cat.upfrontAmount;
                return {
                    ...cat,
                    value,
                    color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
                };
            })
            .filter((item) => item.value > 0)
            .sort((a, b) => b.value - a.value);

        const total = items.reduce((sum, item) => sum + item.value, 0);
        return items.map((item) => ({
            ...item,
            pct: total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0,
        }));
    }, [categories, metricMode]);

    const totalAmount = useMemo(
        () => chartItems.reduce((sum, item) => sum + item.value, 0),
        [chartItems]
    );

    const activeItem = useMemo(
        () =>
            selectedCategory
                ? chartItems.find((i) => i.category.toLowerCase() === selectedCategory.toLowerCase()) ||
                  null
                : null,
        [chartItems, selectedCategory]
    );

    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    const segments = useMemo(() => {
        return chartItems.reduce<
            Array<(typeof chartItems)[number] & { dashLength: number; dashOffset: number; endFraction: number }>
        >((acc, item) => {
            const startFraction = acc.length > 0 ? acc[acc.length - 1].endFraction : 0;
            const fraction = totalAmount > 0 ? item.value / totalAmount : 0;
            const dashLength = Math.max(0, fraction * circumference);
            const dashOffset = -startFraction * circumference;
            acc.push({
                ...item,
                dashLength,
                dashOffset,
                endFraction: startFraction + fraction,
            });
            return acc;
        }, []);
    }, [chartItems, totalAmount, circumference]);

    return (
        <section className="bg-surface-card p-4 rounded-2xl border border-border-subtle shadow-[0_1px_3px_rgba(15,23,42,0.05)] space-y-4">
            {/* Header & Metric Toggle */}
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h2 className="text-[20px] leading-[28px] font-semibold text-on-surface font-headline">
                        Category Breakdown
                    </h2>
                    <p className="text-xs text-on-surface-variant">
                        Tap a slice or row to filter transactions below
                    </p>
                </div>

                {!isGroupView && (
                    <div className="flex items-center bg-surface-card-subtle p-0.5 rounded-xl border border-border-subtle shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic('light');
                                setMetricMode('share');
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                                metricMode === 'share'
                                    ? 'bg-primary text-on-primary shadow-2xs'
                                    : 'text-on-surface-variant hover:text-on-surface'
                            }`}
                        >
                            My Share
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic('light');
                                setMetricMode('upfront');
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                                metricMode === 'upfront'
                                    ? 'bg-secondary text-on-secondary shadow-2xs'
                                    : 'text-on-surface-variant hover:text-on-surface'
                            }`}
                        >
                            Upfront
                        </button>
                    </div>
                )}
            </div>

            {chartItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-on-surface-variant bg-surface-card-subtle/60 rounded-xl border border-dashed border-border-strong">
                    No category spend recorded for this period yet.
                </div>
            ) : (
                <>
                    {/* Donut Chart Centerpiece */}
                    <div className="flex items-center justify-center py-1">
                        <div className="relative w-44 h-44 flex items-center justify-center">
                            <svg
                                viewBox="0 0 160 160"
                                className="w-full h-full -rotate-90 overflow-visible"
                                role="img"
                                aria-label="Spend by category donut chart"
                            >
                                <circle
                                    cx="80"
                                    cy="80"
                                    r={radius}
                                    fill="none"
                                    stroke="#f1f5f9"
                                    strokeWidth="22"
                                />
                                {segments.map((seg) => {
                                    const isSelected =
                                        selectedCategory?.toLowerCase() ===
                                        seg.category.toLowerCase();
                                    const isDimmed = Boolean(selectedCategory && !isSelected);
                                    return (
                                        <circle
                                            key={seg.category}
                                            cx="80"
                                            cy="80"
                                            r={radius}
                                            fill="none"
                                            stroke={seg.color}
                                            strokeWidth={isSelected ? 26 : 22}
                                            strokeDasharray={`${seg.dashLength} ${circumference}`}
                                            strokeDashoffset={seg.dashOffset}
                                            opacity={isDimmed ? 0.3 : 1}
                                            className="transition-[stroke-width,opacity] duration-300 cursor-pointer"
                                            onClick={() => {
                                                triggerHaptic('light');
                                                onSelectCategory(isSelected ? null : seg.category);
                                            }}
                                        />
                                    );
                                })}
                            </svg>

                            {/* Donut Center Readout */}
                            <button
                                type="button"
                                onClick={() => {
                                    if (selectedCategory) {
                                        triggerHaptic('light');
                                        onSelectCategory(null);
                                    }
                                }}
                                className="absolute inset-8 rounded-full flex flex-col items-center justify-center text-center px-2 cursor-pointer"
                                title={selectedCategory ? 'Tap to clear filter' : undefined}
                            >
                                <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant font-mono truncate max-w-full">
                                    {activeItem ? activeItem.category : 'Total'}
                                </span>
                                <span className="text-lg font-bold text-on-surface font-mono tabular-nums tracking-tight leading-tight mt-0.5">
                                    ₹
                                    {Math.round(
                                        activeItem ? activeItem.value : totalAmount
                                    ).toLocaleString('en-IN')}
                                </span>
                                <span className="text-[11px] font-semibold text-primary mt-0.5 tabular-nums">
                                    {activeItem
                                        ? `${activeItem.pct}% · Tap to reset`
                                        : `${chartItems.length} categories`}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Ranked Category Progress Bars */}
                    <div className="space-y-2">
                        {chartItems.map((item) => {
                            const meta = getCategoryMeta(item.category);
                            const isSelected =
                                selectedCategory?.toLowerCase() === item.category.toLowerCase();
                            const isDimmed = Boolean(selectedCategory && !isSelected);

                            return (
                                <button
                                    key={item.category}
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic('light');
                                        onSelectCategory(isSelected ? null : item.category);
                                    }}
                                    className={`w-full text-left p-2.5 rounded-xl border transition-[border-color,background-color,opacity] cursor-pointer ${
                                        isSelected
                                            ? 'bg-primary/5 border-primary/50 shadow-2xs'
                                            : 'bg-surface-card-subtle/60 border-border-subtle hover:border-border-strong'
                                    } ${isDimmed ? 'opacity-55' : 'opacity-100'}`}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div
                                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.bgClass} ${meta.textClass}`}
                                            >
                                                <AppIcon name={meta.icon} className="text-[16px]" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className="w-2 h-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: item.color }}
                                                    />
                                                    <span className="text-xs font-bold text-on-surface truncate">
                                                        {item.category}
                                                    </span>
                                                </div>
                                                <span className="text-[11px] text-on-surface-variant block tabular-nums">
                                                    {item.count} {item.count === 1 ? 'item' : 'items'} ·
                                                    avg ₹{Math.round(item.avgAmount).toLocaleString('en-IN')}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <span className="text-sm font-semibold text-on-surface font-mono tabular-nums block">
                                                ₹{item.value.toLocaleString('en-IN')}
                                            </span>
                                            <span className="text-[11px] font-semibold font-mono tabular-nums text-primary">
                                                {item.pct}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Proportional Progress Bar */}
                                    <div className="w-full h-1.5 bg-border-subtle/70 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-[width] duration-300"
                                            style={{
                                                width: `${Math.max(3, item.pct)}%`,
                                                backgroundColor: item.color,
                                            }}
                                        />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </section>
    );
};

export default CategoryDonutCard;
