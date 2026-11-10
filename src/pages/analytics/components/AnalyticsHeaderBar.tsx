import React from 'react';
import { Avatar } from '../../../components';
import type { AnalyticsRange } from '../../../api/types';
import { triggerHaptic } from '../../../utils/haptics';

const RANGE_OPTIONS: { id: AnalyticsRange; label: string }[] = [
    { id: 'all', label: 'All Time' },
    { id: 'this_month', label: 'This Month' },
    { id: '30d', label: '30 Days' },
    { id: '7d', label: '7 Days' },
];

interface AnalyticsHeaderBarProps {
    effectivePerson: string;
    isGroupView: boolean;
    canSwitchScope: boolean;
    selectedPerson: string;
    selectedRange: AnalyticsRange;
    selectedMonth: string;
    availablePeople: string[];
    availableMonths: string[];
    isRefreshing: boolean;
    onRefresh: () => void;
    onSelectPerson: (person: string) => void;
    onSelectRange: (range: AnalyticsRange) => void;
    onSelectMonth: (month: string) => void;
}

export const AnalyticsHeaderBar: React.FC<AnalyticsHeaderBarProps> = ({
    effectivePerson,
    isGroupView,
    canSwitchScope,
    selectedPerson,
    selectedRange,
    selectedMonth,
    availablePeople,
    availableMonths,
    isRefreshing,
    onRefresh,
    onSelectPerson,
    onSelectRange,
    onSelectMonth,
}) => {
    const scopeSubtitle = isGroupView
        ? 'Whole Group Overview'
        : `${effectivePerson}'s Spend Insights`;
    const activeRangeLabel =
        selectedMonth !== 'ALL'
            ? selectedMonth
            : RANGE_OPTIONS.find((r) => r.id === selectedRange)?.label || 'All Time';

    return (
        <div className="space-y-4">
            {/* Page Header */}
            <div className="flex items-center justify-between pt-1 gap-2">
                <div className="min-w-0">
                    <h1 className="headline-lg text-on-surface tracking-tight">
                        Spend Analytics
                    </h1>
                    <p className="text-xs font-medium text-on-surface-variant mt-0.5 truncate">
                        {scopeSubtitle} • {activeRangeLabel}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="w-9 h-9 rounded-xl bg-surface-card hover:bg-surface-card-subtle flex items-center justify-center text-on-surface transition-colors cursor-pointer border border-border-subtle shadow-[0_1px_3px_rgba(15,23,42,0.05)] shrink-0"
                    title="Refresh analytics from Google Sheets"
                    aria-label="Refresh analytics"
                >
                    <span
                        className={`material-symbols-outlined text-[18px] ${
                            isRefreshing ? 'animate-spin text-primary' : ''
                        }`}
                    >
                        sync
                    </span>
                </button>
            </div>

            {/* Scope Switcher (Level 2 Elevation + DESIGN.md Section 6.1 Active Ring & Avatars) */}
            {canSwitchScope ? (
                <div className="bg-surface-card border border-border-strong rounded-2xl px-2 py-1.5 shadow-[0_4px_6px_-1px_rgba(15,23,42,0.08)]">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar snap-x px-1 py-1">
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic('light');
                                onSelectPerson('ALL');
                            }}
                            className={`snap-start px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                selectedPerson === 'ALL'
                                    ? 'bg-primary text-on-primary border-primary ring-2 ring-primary ring-offset-2 ring-offset-surface-card'
                                    : 'bg-surface-card-subtle text-on-surface-variant border-border-subtle hover:border-border-strong'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[15px]">groups</span>
                            <span>Whole Group</span>
                        </button>

                        {availablePeople.map((person) => {
                            const isActive =
                                selectedPerson.toLowerCase() === person.toLowerCase();
                            return (
                                <button
                                    key={person}
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic('light');
                                        onSelectPerson(person);
                                    }}
                                    className={`snap-start pl-1.5 pr-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                        isActive
                                            ? 'bg-primary text-on-primary border-primary ring-2 ring-primary ring-offset-2 ring-offset-surface-card'
                                            : 'bg-surface-card-subtle text-on-surface-variant border-border-subtle hover:border-border-strong'
                                    }`}
                                >
                                    <Avatar
                                        name={person}
                                        size="sm"
                                        className={
                                            isActive
                                                ? '!w-5 !h-5 !text-[9px] !bg-white/20 !text-white ring-1 ring-white/30'
                                                : '!w-5 !h-5 !text-[9px]'
                                        }
                                    />
                                    <span>{person}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="px-3.5 py-2 rounded-2xl bg-surface-card-subtle border border-border-strong shadow-[0_4px_6px_-1px_rgba(15,23,42,0.08)] flex items-center justify-between gap-2 text-xs text-on-surface-variant">
                    <span className="flex items-center gap-2 min-w-0">
                        <Avatar
                            name={effectivePerson}
                            size="sm"
                            className="!w-6 !h-6 !text-[10px]"
                        />
                        <span className="truncate">
                            Personal view for{' '}
                            <strong className="text-on-surface">{effectivePerson}</strong>
                        </span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-status-settled-bg text-status-settled-text label-pill uppercase shrink-0 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                        Private
                    </span>
                </div>
            )}

            {/* Timeframe & Month Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {RANGE_OPTIONS.map((opt) => {
                    const isActive = selectedMonth === 'ALL' && selectedRange === opt.id;
                    return (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => onSelectRange(opt.id)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold font-mono uppercase tracking-[0.04em] border whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                                isActive
                                    ? 'bg-secondary text-on-secondary border-secondary shadow-2xs'
                                    : 'bg-surface-card text-on-surface-variant border-border-subtle hover:border-border-strong'
                            }`}
                        >
                            {opt.label}
                        </button>
                    );
                })}

                {availableMonths.map((month) => {
                    const isActive = selectedMonth.toLowerCase() === month.toLowerCase();
                    return (
                        <button
                            key={month}
                            type="button"
                            onClick={() => onSelectMonth(isActive ? 'ALL' : month)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold font-mono border whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                                isActive
                                    ? 'bg-secondary text-on-secondary border-secondary shadow-2xs'
                                    : 'bg-surface-card text-on-surface-variant border-border-subtle hover:border-border-strong'
                            }`}
                        >
                            {month}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default AnalyticsHeaderBar;

