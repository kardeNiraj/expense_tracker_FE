import React from 'react';
import type { AdminDashboardSummary } from '../../../api/types';

interface AdminHeroSummaryProps {
    summary: AdminDashboardSummary;
    isBusy: boolean;
    onRefresh: () => void;
    onBulkLock: (locked: boolean) => void;
    onExitAdmin: () => void;
}

export const AdminHeroSummary: React.FC<AdminHeroSummaryProps> = ({
    summary,
    isBusy,
    onRefresh,
    onBulkLock,
    onExitAdmin,
}) => {
    const allLocked =
        summary.totalPeople > 0 && summary.lockedPeopleCount >= summary.totalPeople;

    return (
        <section className="space-y-3">
            {/* Hero Command Banner */}
            <div className="bg-primary text-on-primary rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <span className="label-pill text-primary-light uppercase block">
                            Strict Security Level
                        </span>
                        <h1 className="headline-lg text-on-primary pt-0.5">
                            Admin Control Center
                        </h1>
                        <p className="text-xs text-primary-light/90 pt-0.5">
                            Manage device claims, block rogue IDs, and enforce claim locks
                        </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={onRefresh}
                            disabled={isBusy}
                            className="w-9 h-9 rounded-xl bg-on-primary/15 hover:bg-on-primary/25 text-on-primary flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50"
                            title="Refresh admin data"
                            aria-label="Refresh admin data"
                        >
                            <span className="material-symbols-outlined text-[18px]">
                                refresh
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={onExitAdmin}
                            className="h-9 px-3 rounded-xl bg-on-primary/15 hover:bg-on-primary/25 text-on-primary text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Lock admin mode and return to app"
                        >
                            <span className="material-symbols-outlined text-[15px]">lock</span>
                            <span>Exit</span>
                        </button>
                    </div>
                </div>

                {/* Global Claim Lock Action Strip */}
                <div className="p-3 rounded-2xl bg-black/20 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <span className="text-xs font-bold text-on-primary block">
                            {allLocked
                                ? 'All Member Identities Locked'
                                : 'New Device Claim Protection'}
                        </span>
                        <span className="text-[11px] text-primary-light/90 block">
                            {summary.lockedPeopleCount} of {summary.totalPeople} identities locked against unrecognized devices
                        </span>
                    </div>
                    <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onBulkLock(!allLocked)}
                        className={`h-8 px-3 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors disabled:opacity-50 ${
                            allLocked
                                ? 'bg-on-primary text-primary hover:bg-primary-fixed'
                                : 'bg-primary-light text-on-primary-fixed hover:bg-primary-fixed'
                        }`}
                    >
                        {allLocked ? 'Unlock All' : 'Lock All IDs'}
                    </button>
                </div>
            </div>

            {/* 2x2 Admin KPI Bento Grid */}
            <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-surface-card border border-border-subtle rounded-2xl p-3.5 space-y-1">
                    <span className="label-pill text-on-surface-variant uppercase block">
                        Devices
                    </span>
                    <div className="text-2xl font-bold font-mono tabular-nums text-on-surface">
                        {summary.activeDevices}
                        <span className="text-xs font-normal text-on-surface-variant ml-1">
                            / {summary.totalDevices}
                        </span>
                    </div>
                    <span className="text-[11px] text-on-surface-variant block">
                        {summary.claimedDevices} claimed · {summary.unclaimedDevices} unclaimed
                    </span>
                </div>

                <div
                    className={`border rounded-2xl p-3.5 space-y-1 ${
                        summary.multiDevicePeopleCount > 0
                            ? 'bg-status-pending-bg/45 border-tertiary/40'
                            : 'bg-surface-card border-border-subtle'
                    }`}
                >
                    <span className="label-pill text-on-surface-variant uppercase block">
                        Multi-Device IDs
                    </span>
                    <div
                        className={`text-2xl font-bold font-mono tabular-nums ${
                            summary.multiDevicePeopleCount > 0
                                ? 'text-status-pending-text'
                                : 'text-on-surface'
                        }`}
                    >
                        {summary.multiDevicePeopleCount}
                    </div>
                    <span className="text-[11px] text-on-surface-variant block">
                        {summary.multiDevicePeopleCount > 0
                            ? 'People claimed on 2+ devices'
                            : 'Single-device integrity intact'}
                    </span>
                </div>

                <div className="bg-surface-card border border-border-subtle rounded-2xl p-3.5 space-y-1">
                    <span className="label-pill text-on-surface-variant uppercase block">
                        Blocked Devices
                    </span>
                    <div
                        className={`text-2xl font-bold font-mono tabular-nums ${
                            summary.blockedDevices > 0 ? 'text-negative' : 'text-on-surface'
                        }`}
                    >
                        {summary.blockedDevices}
                    </div>
                    <span className="text-[11px] text-on-surface-variant block">
                        {summary.lockedPeopleCount} identities protected
                    </span>
                </div>

                <div
                    className={`border rounded-2xl p-3.5 space-y-1 ${
                        summary.pendingApprovalsCount > 0
                            ? 'bg-status-awaiting-bg/60 border-status-awaiting-text/30'
                            : 'bg-surface-card border-border-subtle'
                    }`}
                >
                    <span className="label-pill text-on-surface-variant uppercase block">
                        Pending Approvals
                    </span>
                    <div
                        className={`text-2xl font-bold font-mono tabular-nums ${
                            summary.pendingApprovalsCount > 0
                                ? 'text-status-awaiting-text'
                                : 'text-on-surface'
                        }`}
                    >
                        {summary.pendingApprovalsCount}
                    </div>
                    <span className="text-[11px] text-on-surface-variant block">
                        {summary.pendingApprovalsCount > 0
                            ? 'Waiting for admin confirmation'
                            : 'No pending requests'}
                    </span>
                </div>
            </div>
        </section>
    );
};

export default AdminHeroSummary;

