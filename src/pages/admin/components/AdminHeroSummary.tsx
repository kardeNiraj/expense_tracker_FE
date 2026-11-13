import React, { useId } from 'react';
import type { AdminDashboardSummary, AdminRoomSummary } from '../../../api/types';
import { AppIcon } from '../../../components';
import { formatCurrency } from '../../../utils/formatters';

interface AdminHeroSummaryProps {
    summary: AdminDashboardSummary;
    rooms?: AdminRoomSummary[];
    selectedScope: string;
    onSelectScope: (scope: string) => void;
    isBusy: boolean;
    onRefresh: () => void;
    onBulkLock: (locked: boolean) => void;
    onExitAdmin: () => void;
}

export const AdminHeroSummary: React.FC<AdminHeroSummaryProps> = ({
    summary,
    rooms = [],
    selectedScope,
    onSelectScope,
    isBusy,
    onRefresh,
    onBulkLock,
    onExitAdmin,
}) => {
    const scopeSelectId = useId();
    const allLocked =
        summary.totalPeople > 0 && summary.lockedPeopleCount >= summary.totalPeople;

    const isGlobal = summary.scope?.isGlobal ?? (selectedScope === 'ALL');

    return (
        <section className="space-y-3">
            {/* Hero Command Banner */}
            <div className="bg-primary text-on-primary rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                        <span className="label-pill text-primary-light uppercase block">
                            Strict Security Level
                        </span>
                        <h1 className="headline-lg text-on-primary pt-0.5">
                            Admin Control Center
                        </h1>
                        <p className="text-xs text-primary-light/90 pt-0.5">
                            Manage room fleets, device claims, and system-wide security
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
                            <AppIcon name="refresh" className="text-[18px]" />
                        </button>
                        <button
                            type="button"
                            onClick={onExitAdmin}
                            className="h-9 px-3 rounded-xl bg-on-primary/15 hover:bg-on-primary/25 text-on-primary text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Lock admin mode and return to app"
                        >
                            <AppIcon name="lock" className="text-[15px]" />
                            <span>Exit</span>
                        </button>
                    </div>
                </div>

                {/* Scope Switcher & Attention Strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                    <div className="w-full sm:w-auto min-w-0 max-w-full flex items-center gap-2 bg-black/30 px-3 py-2 rounded-2xl border border-on-primary/15">
                        <AppIcon name="public" className="text-primary-light text-[18px] shrink-0" />
                        <label htmlFor={scopeSelectId} className="text-[11px] font-bold text-primary-light uppercase tracking-wider shrink-0">
                            Scope:
                        </label>
                        <select
                            id={scopeSelectId}
                            value={selectedScope}
                            onChange={(e) => onSelectScope(e.target.value)}
                            className="bg-transparent text-xs font-bold text-on-primary focus:outline-none cursor-pointer w-full min-w-0 truncate"
                        >
                            <option value="ALL" className="bg-dark-slate text-white">
                                🌐 All Rooms (Platform View)
                            </option>
                            {rooms.map((r) => (
                                <option key={r.groupId} value={r.groupId} className="bg-dark-slate text-white">
                                    🏠 {r.name} ({r.status})
                                </option>
                            ))}
                        </select>
                    </div>

                    {summary.pendingApprovalsCount > 0 && (
                        <div className="self-start sm:self-auto px-3 py-1.5 rounded-2xl bg-status-pending-bg text-status-pending-text flex items-center gap-1.5 text-xs font-bold animate-pulse shrink-0">
                            <AppIcon name="priority_high" className="text-[15px]" />
                            <span>{summary.pendingApprovalsCount} Approval{summary.pendingApprovalsCount === 1 ? '' : 's'} Pending</span>
                        </div>
                    )}
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
                {/* 1. Platform / Room Spend & Debt */}
                <div className="bg-surface-card border border-border-subtle rounded-2xl p-3.5 space-y-1">
                    <span className="label-pill text-on-surface-variant uppercase block">
                        {isGlobal ? 'Platform Spend' : `${summary.scope?.groupName || 'Room'} Spend`}
                    </span>
                    <div className="text-2xl font-bold font-mono tabular-nums text-on-surface">
                        {formatCurrency(summary.totalPlatformSpend ?? 0)}
                    </div>
                    <span className="text-[11px] text-on-surface-variant block">
                        {formatCurrency(summary.totalInFlightDebt ?? 0)} in-flight unsettled
                    </span>
                </div>

                {/* 2. Room Fleet Overview */}
                <div className="bg-surface-card border border-border-subtle rounded-2xl p-3.5 space-y-1">
                    <span className="label-pill text-on-surface-variant uppercase block">
                        {isGlobal ? 'Rooms Fleet' : 'Room Status'}
                    </span>
                    <div className="text-2xl font-bold font-mono tabular-nums text-on-surface">
                        {isGlobal ? (
                            <>
                                {summary.activeRooms ?? (rooms.length > 0 ? rooms.filter((r) => r.status === 'ACTIVE').length : 0)}
                                <span className="text-xs font-normal text-on-surface-variant ml-1">
                                    active / {summary.totalRooms ?? rooms.length} total
                                </span>
                            </>
                        ) : (
                            <span className="text-xl">
                                {summary.scope?.roomStatus || 'ACTIVE'}
                            </span>
                        )}
                    </div>
                    <span className="text-[11px] text-on-surface-variant block truncate">
                        {isGlobal
                            ? `${summary.archivedRooms ?? 0} archived · ${summary.closedRooms ?? 0} closed`
                            : `${summary.scope?.claimedMemberCount ?? 0}/${summary.scope?.memberCount ?? 0} claimed · Owner: ${summary.scope?.ownerName || 'Unknown'}`
                        }
                    </span>
                </div>

                {/* 3. Device Fleet Health */}
                <div className="bg-surface-card border border-border-subtle rounded-2xl p-3.5 space-y-1">
                    <span className="label-pill text-on-surface-variant uppercase block">
                        {isGlobal ? 'Device Fleet' : 'Room Devices'}
                    </span>
                    <div className="text-2xl font-bold font-mono tabular-nums text-on-surface">
                        {summary.activeDevices}
                        <span className="text-xs font-normal text-on-surface-variant ml-1">
                            active / {summary.totalDevices}
                        </span>
                    </div>
                    <span className="text-[11px] text-on-surface-variant block">
                        {summary.idleDevices ?? 0} idle · {summary.dormantDevices ?? 0} dormant · {summary.blockedDevices} blocked
                    </span>
                </div>

                {/* 4. Users & Members */}
                <div className="bg-surface-card border border-border-subtle rounded-2xl p-3.5 space-y-1">
                    <span className="label-pill text-on-surface-variant uppercase block">
                        {isGlobal ? 'Users & Members' : 'Room Members'}
                    </span>
                    <div className="text-2xl font-bold font-mono tabular-nums text-on-surface">
                        {isGlobal ? (
                            <>
                                {summary.totalUsers ?? 0}
                                <span className="text-xs font-normal text-on-surface-variant ml-1">
                                    users
                                </span>
                            </>
                        ) : (
                            <>
                                {summary.totalPeople}
                                <span className="text-xs font-normal text-on-surface-variant ml-1">
                                    members
                                </span>
                            </>
                        )}
                    </div>
                    <span className="text-[11px] text-on-surface-variant block">
                        {summary.claimedDevices} active devices · {summary.lockedPeopleCount} locked
                    </span>
                </div>
            </div>
        </section>
    );
};

export default AdminHeroSummary;

