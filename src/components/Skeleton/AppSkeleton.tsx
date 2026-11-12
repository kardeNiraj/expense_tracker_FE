import React from 'react';

const RECENT_ITEM_KEYS = ['recent-1', 'recent-2', 'recent-3'] as const;
const SPLITS_ITEM_KEYS = ['split-1', 'split-2', 'split-3'] as const;
const PEOPLE_ITEM_KEYS = ['member-1', 'member-2', 'member-3', 'member-4', 'member-5'] as const;
const CLAIM_ITEM_KEYS = ['claim-1', 'claim-2', 'claim-3', 'claim-4'] as const;
const HISTORY_ROW_KEYS = ['hist-1', 'hist-2', 'hist-3', 'hist-4'] as const;
const ANALYTICS_BAR_KEYS = ['bar-1', 'bar-2', 'bar-3'] as const;
const NAV_TAB_KEYS = ['nav-home', 'nav-splits', 'nav-add', 'nav-charts', 'nav-people'] as const;

export const AppShellSkeleton: React.FC = () => (
    <>
        {/* Desktop (>= 768px) placeholder matching MobileGate */}
        <div
            className="hidden md:flex min-h-screen w-full bg-neutral-50 text-neutral-900 flex-col items-center justify-center p-6 select-none"
            aria-busy="true"
            aria-label="Loading SplitNest"
        >
            <div className="max-w-lg w-full bg-white/95 border border-neutral-200/80 rounded-3xl p-8 shadow-xl shadow-neutral-900/5 space-y-6">
                <div className="w-40 h-7 rounded-full bg-primary/10 mx-auto animate-pulse" />
                <div className="w-24 h-40 rounded-2xl border-4 border-neutral-200 bg-neutral-50 mx-auto animate-pulse" />
                <div className="space-y-2.5 max-w-xs mx-auto">
                    <div className="h-7 rounded-xl bg-neutral-200/75 animate-pulse" />
                    <div className="h-4 w-5/6 rounded-lg bg-neutral-100 mx-auto animate-pulse" />
                </div>
                <div className="h-20 rounded-2xl bg-neutral-100 border border-neutral-200/70 animate-pulse" />
                <div className="grid grid-cols-2 gap-3">
                    <div className="h-24 rounded-xl bg-neutral-100 animate-pulse" />
                    <div className="h-24 rounded-xl bg-neutral-100 animate-pulse" />
                </div>
                <div className="h-10 rounded-xl bg-primary/20 animate-pulse" />
            </div>
        </div>

        {/* Mobile (< 768px) full-app structural skeleton */}
        <div
            className="block md:hidden min-h-screen w-full bg-surface-canvas text-on-surface flex flex-col relative font-sans"
            aria-busy="true"
            aria-label="Loading SplitNest"
        >
            {/* Top Sticky Header */}
            <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-surface-canvas/95 border-b border-border-subtle px-4 flex items-center justify-between max-w-md mx-auto">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/15 animate-pulse shrink-0" />
                    <div className="space-y-1.5">
                        <div className="h-3.5 w-24 rounded-md bg-slate-200/80 animate-pulse" />
                        <div className="h-2.5 w-32 rounded bg-slate-200/60 animate-pulse" />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-8 w-16 rounded-full bg-slate-200/70 animate-pulse" />
                    <div className="h-9 w-9 rounded-full bg-primary/15 animate-pulse" />
                </div>
            </header>

            {/* Main Dashboard Body Skeleton */}
            <main className="flex-1 w-full max-w-md mx-auto px-4 pt-20 pb-24 space-y-5">
                {/* Greeting + Standing Pill */}
                <div className="flex items-center justify-between pt-1">
                    <div className="space-y-1.5">
                        <div className="h-7 w-28 rounded-lg bg-slate-200/80 animate-pulse" />
                        <div className="h-3.5 w-36 rounded bg-slate-200/60 animate-pulse" />
                    </div>
                    <div className="h-8 w-28 rounded-full bg-slate-200/75 animate-pulse" />
                </div>

                {/* Settlement 2-card Row */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface-card p-3.5 rounded-2xl border border-border-subtle space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div className="h-2.5 w-24 rounded bg-slate-200/70 animate-pulse" />
                            <div className="w-6 h-6 rounded-full bg-primary/10 animate-pulse" />
                        </div>
                        <div className="h-6 w-20 rounded-md bg-slate-200/85 animate-pulse" />
                        <div className="h-3 w-20 rounded bg-slate-200/60 animate-pulse" />
                    </div>
                    <div className="bg-surface-card p-3.5 rounded-2xl border border-border-subtle space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div className="h-2.5 w-16 rounded bg-slate-200/70 animate-pulse" />
                            <div className="w-6 h-6 rounded-full bg-slate-200/70 animate-pulse" />
                        </div>
                        <div className="h-6 w-20 rounded-md bg-slate-200/85 animate-pulse" />
                        <div className="h-3 w-16 rounded bg-slate-200/60 animate-pulse" />
                    </div>
                </div>

                {/* Spendings 2-card Bento Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface-card p-4 rounded-2xl border border-border-subtle space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="h-3 w-20 rounded bg-slate-200/70 animate-pulse" />
                            <div className="w-6 h-6 rounded-full bg-primary/10 animate-pulse" />
                        </div>
                        <div className="h-7 w-24 rounded-md bg-slate-200/85 animate-pulse" />
                        <div className="h-3 w-28 rounded bg-slate-200/60 animate-pulse" />
                    </div>
                    <div className="bg-surface-card p-4 rounded-2xl border border-border-subtle space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="h-3 w-20 rounded bg-slate-200/70 animate-pulse" />
                            <div className="w-6 h-6 rounded-full bg-slate-200/70 animate-pulse" />
                        </div>
                        <div className="h-7 w-20 rounded-md bg-slate-200/85 animate-pulse" />
                        <div className="h-3 w-24 rounded bg-slate-200/60 animate-pulse" />
                    </div>
                </div>

                {/* Quick Action Buttons + Banners */}
                <div className="flex items-center gap-2.5">
                    <div className="flex-1 h-12 rounded-xl bg-primary/15 animate-pulse" />
                    <div className="flex-1 h-12 rounded-xl bg-slate-200/70 animate-pulse" />
                </div>
                <div className="h-14 rounded-2xl bg-surface-card border border-border-subtle animate-pulse" />
                <div className="h-14 rounded-2xl bg-surface-card border border-border-subtle animate-pulse" />

                {/* Recent Spendings List Skeleton */}
                <RecentExpensesSkeleton />
            </main>

            {/* Bottom Navigation Bar Skeleton */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-surface-card border-t border-border-subtle px-4 flex items-center justify-around max-w-md mx-auto pb-safe">
                {NAV_TAB_KEYS.map((key) => (
                    <div key={key} className="flex flex-col items-center gap-1">
                        <div
                            className={`rounded-xl animate-pulse ${
                                key === 'nav-add'
                                    ? 'w-11 h-8 bg-primary/20'
                                    : 'w-6 h-6 bg-slate-200/80'
                            }`}
                        />
                        <div className="h-2 w-8 rounded bg-slate-200/60 animate-pulse" />
                    </div>
                ))}
            </nav>
        </div>
    </>
);

export const DashboardPendingSkeleton: React.FC = () => (
    <div className="space-y-2.5" aria-busy="true" aria-label="Loading pending settlements">
        <div className="flex items-center justify-between px-1">
            <div className="h-4 w-36 rounded bg-slate-200/80 animate-pulse" />
            <div className="h-4 w-16 rounded-full bg-slate-200/60 animate-pulse" />
        </div>
        <div className="bg-surface-card p-3.5 rounded-2xl border border-border-subtle space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-slate-200/80 animate-pulse shrink-0" />
                    <div className="space-y-1.5">
                        <div className="h-3.5 w-28 rounded bg-slate-200/85 animate-pulse" />
                        <div className="h-3 w-36 rounded bg-slate-200/60 animate-pulse" />
                    </div>
                </div>
                <div className="h-5 w-16 rounded-md bg-slate-200/85 animate-pulse" />
            </div>
            <div className="flex gap-2">
                <div className="flex-1 h-9 rounded-xl bg-slate-200/70 animate-pulse" />
                <div className="w-24 h-9 rounded-xl bg-primary/15 animate-pulse" />
            </div>
        </div>
    </div>
);

export const RecentExpensesSkeleton: React.FC = () => (
    <div className="space-y-2.5" aria-busy="true" aria-label="Loading recent spendings">
        {RECENT_ITEM_KEYS.map((key) => (
            <div
                key={key}
                className="bg-surface-card p-3.5 rounded-2xl border border-border-subtle space-y-3"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-200/80 animate-pulse shrink-0" />
                        <div className="flex-1 space-y-2 pt-0.5">
                            <div className="h-4 w-3/4 rounded bg-slate-200/85 animate-pulse" />
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-16 rounded bg-slate-200/70 animate-pulse" />
                                <div className="h-4 w-14 rounded-md bg-slate-200/60 animate-pulse" />
                            </div>
                        </div>
                    </div>
                    <div className="space-y-1.5 text-right shrink-0">
                        <div className="h-5 w-14 rounded bg-slate-200/85 animate-pulse ml-auto" />
                        <div className="h-3 w-16 rounded bg-slate-200/60 animate-pulse ml-auto" />
                    </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border-subtle/50">
                    <div className="h-3 w-28 rounded bg-slate-200/65 animate-pulse" />
                    <div className="h-4 w-24 rounded-md bg-slate-200/70 animate-pulse" />
                </div>
            </div>
        ))}
    </div>
);

export const SplitsSkeleton: React.FC = () => (
    <div className="space-y-3 pt-1" aria-busy="true" aria-label="Loading splits">
        {/* Hero Settle Banner Placeholder */}
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="h-4 w-32 rounded bg-slate-200/85 animate-pulse" />
                <div className="h-6 w-20 rounded-full bg-primary/15 animate-pulse" />
            </div>
            <div className="h-10 rounded-xl bg-slate-200/70 animate-pulse" />
        </div>

        {/* Filter Pills Placeholder */}
        <div className="flex items-center gap-2">
            <div className="h-8 w-16 rounded-full bg-primary/15 animate-pulse" />
            <div className="h-8 w-20 rounded-full bg-slate-200/75 animate-pulse" />
            <div className="h-8 w-20 rounded-full bg-slate-200/75 animate-pulse" />
            <div className="h-8 w-20 rounded-full bg-slate-200/75 animate-pulse" />
        </div>

        {/* Split Card Skeletons */}
        {SPLITS_ITEM_KEYS.map((key) => (
            <div
                key={key}
                className="bg-surface-card rounded-2xl p-4 border border-border-subtle space-y-3"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-200/80 animate-pulse shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-2/3 rounded bg-slate-200/85 animate-pulse" />
                            <div className="h-3 w-1/2 rounded bg-slate-200/65 animate-pulse" />
                        </div>
                    </div>
                    <div className="space-y-1.5 shrink-0">
                        <div className="h-5 w-16 rounded bg-slate-200/85 animate-pulse ml-auto" />
                        <div className="h-4 w-14 rounded-full bg-slate-200/65 animate-pulse ml-auto" />
                    </div>
                </div>
                <div className="h-8 rounded-xl bg-slate-200/60 animate-pulse" />
            </div>
        ))}
    </div>
);

export const AddPageSkeleton: React.FC = () => (
    <div className="space-y-4 pt-1" aria-busy="true" aria-label="Loading add form">
        {/* Segmented Control */}
        <div className="h-11 rounded-2xl bg-slate-200/75 animate-pulse" />

        {/* Amount Hero Card */}
        <div className="bg-surface-card rounded-2xl p-6 border border-border-subtle flex flex-col items-center gap-3">
            <div className="h-3 w-24 rounded bg-slate-200/70 animate-pulse" />
            <div className="h-10 w-36 rounded-xl bg-slate-200/85 animate-pulse" />
        </div>

        {/* Description & Category Cards */}
        <div className="bg-surface-card rounded-2xl p-4 border border-border-subtle space-y-3">
            <div className="h-3.5 w-24 rounded bg-slate-200/70 animate-pulse" />
            <div className="h-11 rounded-xl bg-slate-200/75 animate-pulse" />
        </div>
        <div className="bg-surface-card rounded-2xl p-4 border border-border-subtle space-y-3">
            <div className="h-3.5 w-20 rounded bg-slate-200/70 animate-pulse" />
            <div className="flex flex-wrap gap-2">
                <div className="h-8 w-20 rounded-lg bg-slate-200/75 animate-pulse" />
                <div className="h-8 w-24 rounded-lg bg-slate-200/75 animate-pulse" />
                <div className="h-8 w-16 rounded-lg bg-slate-200/75 animate-pulse" />
                <div className="h-8 w-20 rounded-lg bg-slate-200/75 animate-pulse" />
            </div>
        </div>

        {/* Submit CTA */}
        <div className="h-12 rounded-xl bg-primary/20 animate-pulse" />
    </div>
);

export const PeopleSkeleton: React.FC = () => (
    <div className="space-y-3 pt-1" aria-busy="true" aria-label="Loading trip members">
        <div className="h-16 rounded-2xl bg-surface-card border border-border-subtle p-4 flex items-center justify-between">
            <div className="space-y-1.5">
                <div className="h-4 w-32 rounded bg-slate-200/85 animate-pulse" />
                <div className="h-3 w-44 rounded bg-slate-200/65 animate-pulse" />
            </div>
            <div className="h-8 w-20 rounded-xl bg-primary/15 animate-pulse" />
        </div>
        {PEOPLE_ITEM_KEYS.map((key) => (
            <div
                key={key}
                className="bg-surface-card p-3.5 rounded-2xl border border-border-subtle flex items-center justify-between gap-3"
            >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-slate-200/85 animate-pulse shrink-0" />
                    <div className="space-y-2 flex-1">
                        <div className="h-4 w-28 rounded bg-slate-200/85 animate-pulse" />
                        <div className="h-3 w-40 rounded bg-slate-200/65 animate-pulse" />
                    </div>
                </div>
                <div className="h-8 w-16 rounded-xl bg-slate-200/75 animate-pulse shrink-0" />
            </div>
        ))}
    </div>
);

export const SpendHistorySkeleton: React.FC = () => (
    <div className="space-y-4 py-2" aria-busy="true" aria-label="Loading spend history">
        <div className="flex items-center justify-between px-1">
            <div className="h-4 w-28 rounded bg-slate-200/80 animate-pulse" />
            <div className="h-4 w-16 rounded bg-slate-200/70 animate-pulse" />
        </div>
        <div className="space-y-2.5">
            {HISTORY_ROW_KEYS.map((key) => (
                <div
                    key={key}
                    className="bg-surface-card p-3 rounded-2xl border border-border-subtle flex items-center justify-between gap-3"
                >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-200/80 animate-pulse shrink-0" />
                        <div className="space-y-1.5 flex-1">
                            <div className="h-3.5 w-3/4 rounded bg-slate-200/85 animate-pulse" />
                            <div className="h-3 w-1/2 rounded bg-slate-200/65 animate-pulse" />
                        </div>
                    </div>
                    <div className="space-y-1.5 shrink-0">
                        <div className="h-4 w-14 rounded bg-slate-200/85 animate-pulse ml-auto" />
                        <div className="h-3 w-12 rounded bg-slate-200/65 animate-pulse ml-auto" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export const ClaimMembersSkeleton: React.FC = () => (
    <div className="space-y-2.5 pt-1" aria-busy="true" aria-label="Loading trip members">
        {CLAIM_ITEM_KEYS.map((key) => (
            <div
                key={key}
                className="h-16 rounded-2xl bg-surface-card flex items-center justify-between px-4 gap-3 border border-border-subtle"
            >
                <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-slate-200/85 animate-pulse shrink-0" />
                    <div className="space-y-1.5 flex-1">
                        <div className="h-4 w-28 rounded bg-slate-200/85 animate-pulse" />
                        <div className="h-3 w-36 rounded bg-slate-200/65 animate-pulse" />
                    </div>
                </div>
                <div className="h-8 w-20 rounded-xl bg-primary/15 animate-pulse shrink-0" />
            </div>
        ))}
    </div>
);

export const ClaimIdentitySkeleton: React.FC = () => (
    <div
        className="min-h-screen w-full bg-surface-canvas text-on-surface flex flex-col justify-between px-4 py-8 max-w-md mx-auto font-sans"
        aria-busy="true"
        aria-label="Loading member selector"
    >
        <div className="space-y-5 pt-2">
            <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-primary/20 animate-pulse" />
                <div className="space-y-1.5">
                    <div className="h-3 w-24 rounded bg-slate-200/70 animate-pulse" />
                    <div className="h-5 w-36 rounded bg-slate-200/85 animate-pulse" />
                </div>
            </div>
            <div className="space-y-2">
                <div className="h-7 w-56 rounded-lg bg-slate-200/85 animate-pulse" />
                <div className="h-4 w-full rounded bg-slate-200/65 animate-pulse" />
            </div>
            <ClaimMembersSkeleton />
        </div>
        <div className="h-10 w-60 rounded-lg bg-slate-200/65 mx-auto animate-pulse" />
    </div>
);

export const AnalyticsSkeleton: React.FC = () => (
    <div className="space-y-3.5 pt-2" aria-busy="true" aria-label="Loading analytics">
        <div className="flex items-center justify-between gap-2">
            <div className="h-9 w-36 rounded-xl bg-slate-200/80 animate-pulse" />
            <div className="h-9 w-28 rounded-xl bg-slate-200/70 animate-pulse" />
        </div>
        <div className="h-36 rounded-3xl bg-primary/15 border border-border-subtle p-5 space-y-3 animate-pulse">
            <div className="h-3 w-28 rounded bg-primary/20" />
            <div className="h-8 w-40 rounded-lg bg-primary/20" />
            <div className="h-3 w-52 rounded bg-primary/15" />
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="h-24 rounded-2xl bg-surface-card border border-border-subtle p-3.5 space-y-2">
                <div className="h-3 w-20 rounded bg-slate-200/75 animate-pulse" />
                <div className="h-6 w-24 rounded bg-slate-200/85 animate-pulse" />
            </div>
            <div className="h-24 rounded-2xl bg-surface-card border border-border-subtle p-3.5 space-y-2">
                <div className="h-3 w-20 rounded bg-slate-200/75 animate-pulse" />
                <div className="h-6 w-24 rounded bg-slate-200/85 animate-pulse" />
            </div>
        </div>
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-4 space-y-4">
            <div className="h-5 w-36 rounded bg-slate-200/85 animate-pulse" />
            <div className="w-36 h-36 rounded-full border-[18px] border-slate-200/80 mx-auto animate-pulse" />
            <div className="space-y-2">
                {ANALYTICS_BAR_KEYS.map((key) => (
                    <div key={key} className="h-10 rounded-xl bg-slate-200/65 animate-pulse" />
                ))}
            </div>
        </div>
    </div>
);

export const AdminSkeleton: React.FC = () => (
    <div className="space-y-3 pt-2" aria-busy="true" aria-label="Loading admin console">
        <div className="h-44 rounded-3xl bg-primary/15 border border-border-subtle p-5 space-y-3 animate-pulse">
            <div className="h-3 w-28 rounded bg-primary/20" />
            <div className="h-6 w-48 rounded-lg bg-primary/20" />
            <div className="h-12 rounded-2xl bg-primary/15 mt-4" />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
            <div className="h-24 rounded-2xl bg-surface-card border border-border-subtle animate-pulse" />
            <div className="h-24 rounded-2xl bg-surface-card border border-border-subtle animate-pulse" />
        </div>
        <div className="h-64 rounded-3xl bg-surface-card border border-border-subtle animate-pulse" />
    </div>
);

