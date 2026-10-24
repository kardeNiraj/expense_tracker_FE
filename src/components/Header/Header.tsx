import React, { useState } from 'react';
import { useExpense } from '../../context';
import { usePeople, useHealthCheck, useTripInfo } from '../../api';
import { Avatar } from '../Avatar';

export const Header: React.FC = () => {
    const { activePerson, setActivePerson } = useExpense();
    const { data: people = [] } = usePeople();
    const { data: health } = useHealthCheck();
    const { data: tripInfo } = useTripInfo();
    const [showSwitcher, setShowSwitcher] = useState(false);

    const isHealthy = health?.status === 'healthy';
    const tripTitle = tripInfo?.title || 'Trip Expense';
    const tripSubtitle = tripInfo?.subtitle || 'Expense & Splitter';
    const tripIcon = tripInfo?.icon || 'landscape';

    return (
        <>
            <header className="fixed top-0 inset-x-0 z-50 pt-safe bg-surface/90 backdrop-blur-xl border-b border-outline-variant/20 shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
                <div className="max-w-md mx-auto h-16 px-4 flex items-center justify-between gap-2">
                    {/* Brand */}
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-xs shrink-0">
                            <span className="material-symbols-outlined text-[20px]">
                                {tripIcon}
                            </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className="font-bold text-base text-on-surface tracking-tight font-headline truncate max-w-[130px] sm:max-w-none" title={tripTitle}>
                                    {tripTitle}
                                </span>
                                <span
                                    title={isHealthy ? 'Connected to API' : 'Checking API connection'}
                                    className={`w-2 h-2 rounded-full shrink-0 ${
                                        isHealthy ? 'bg-primary animate-pulse' : 'bg-tertiary'
                                    }`}
                                />
                            </div>
                            <span className="text-[10px] text-primary font-semibold tracking-wider uppercase font-mono truncate">
                                {tripSubtitle}
                            </span>
                        </div>
                    </div>

                    {/* Active Member Switcher Button */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowSwitcher(!showSwitcher)}
                            className="h-9 px-3 rounded-full bg-surface-container flex items-center gap-2 text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer border border-outline-variant/30 text-xs font-semibold"
                            title="Switch Viewing Member"
                        >
                            <Avatar name={activePerson} size="sm" />
                            <span className="truncate max-w-[80px]">
                                {activePerson} (You)
                            </span>
                            <span className="material-symbols-outlined text-on-surface-variant text-[16px]">
                                arrow_drop_down
                            </span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Quick Switcher Modal / Dropdown Backdrop */}
            {showSwitcher && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40 backdrop-blur-xs">
                    <div
                        className="fixed inset-0"
                        onClick={() => setShowSwitcher(false)}
                        aria-hidden="true"
                    />
                    <div className="relative z-10 w-full max-w-sm bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-2xl">
                        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20 mb-3">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-[20px]">
                                    switch_account
                                </span>
                                <h3 className="font-semibold text-sm text-on-surface">
                                    Switch Active Trip Member
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowSwitcher(false)}
                                className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[16px]">
                                    close
                                </span>
                            </button>
                        </div>

                        <div className="space-y-1.5 max-h-[300px] overflow-y-auto no-scrollbar">
                            {people.map((person) => {
                                const isCurrent = person === activePerson;
                                return (
                                    <button
                                        key={person}
                                        type="button"
                                        onClick={() => {
                                            setActivePerson(person);
                                            setShowSwitcher(false);
                                        }}
                                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                                            isCurrent
                                                ? 'bg-primary-fixed/30 border border-primary/30'
                                                : 'hover:bg-surface-container-low border border-transparent'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <Avatar name={person} size="md" />
                                            <div className="min-w-0">
                                                <span className="font-semibold text-sm text-on-surface truncate block">
                                                    {person}
                                                </span>
                                                <span className="text-[11px] text-on-surface-variant">
                                                    {isCurrent ? 'Current viewer' : 'Tap to view as ' + person}
                                                </span>
                                            </div>
                                        </div>
                                        {isCurrent && (
                                            <span className="material-symbols-outlined text-primary text-[20px]">
                                                check
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Header;
