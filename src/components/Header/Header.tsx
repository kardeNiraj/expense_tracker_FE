import React, { useState, useEffect } from 'react';
import { useExpense } from '../../context';
import { usePeople, useTripInfo } from '../../api';
import { Avatar } from '../Avatar';
import { ENV } from '../../config';
import { ProfileModal } from './ProfileModal';
import { JoinTripModal } from './JoinTripModal';
import { SyncStatusModal } from '../SyncModal/SyncStatusModal';
import { SpendHistoryModal } from '../SpendHistory/SpendHistoryModal';
import { useOfflineSync } from '../../utils/useOfflineSync';
import { triggerHaptic } from '../../utils/haptics';
import { AppIcon } from '../Icon/AppIcon';

export const Header: React.FC = () => {
    const {
        user,
        isAuthenticated,
        groups,
        formerGroups,
        activeGroup,
        isFormerActiveGroup,
        setActiveGroupId,
        activePerson,
        setActivePerson,
        claimedPerson,
        isDeviceClaimed,
        claimProfile,
        unlockProfileSwitch,
        unclaimDevice,
        isSwitcherUnlocked,
        lockSwitcher,
        logoutUser,
        setActiveTab,
        showToast,
    } = useExpense();

    const { data: people = [] } = usePeople();
    const {
        data: tripInfo,
        refetch: refetchTripInfo,
        isFetching: isTripInfoFetching,
        isError: isTripInfoError,
    } = useTripInfo();
    const { isOnline, pendingCount, isSyncing, hasBackoff } = useOfflineSync();
    const [showSwitcher, setShowSwitcher] = useState(false);
    const [showRoomMenu, setShowRoomMenu] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [showSpendHistory, setShowSpendHistory] = useState(false);

    useEffect(() => {
        if (!showRoomMenu) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowRoomMenu(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [showRoomMenu]);

    const isHealthy = isOnline && !isTripInfoError && (Boolean(tripInfo) || people.length > 0);
    const matchingTripInfo =
        tripInfo && (!activeGroup || !tripInfo.groupId || tripInfo.groupId === activeGroup.groupId)
            ? tripInfo
            : undefined;
    const tripTitle = activeGroup?.name || matchingTripInfo?.title || ENV.DEFAULT_TRIP_TITLE;
    const tripSubtitle =
        activeGroup?.subtitle || matchingTripInfo?.subtitle || ENV.DEFAULT_TRIP_SUBTITLE;
    const tripIcon = activeGroup?.icon || matchingTripInfo?.icon || ENV.DEFAULT_TRIP_ICON;

    return (
        <>
            {showRoomMenu && (
                <div
                    className="fixed inset-0 z-35 bg-black/20 backdrop-blur-[1px]"
                    onClick={() => setShowRoomMenu(false)}
                    aria-hidden="true"
                />
            )}

            <header className="fixed top-0 inset-x-0 z-40 pt-safe bg-surface/90 backdrop-blur-xl border-b border-outline-variant/20 shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
                <div className="max-w-md mx-auto h-16 px-4 flex items-center justify-between gap-2 relative">
                    {/* Brand / Active Room Switcher */}
                    <div className="flex items-center gap-1.5 min-w-0">
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic('light');
                                if (isAuthenticated && (groups.length > 0 || formerGroups.length > 0)) {
                                    setShowRoomMenu((v) => !v);
                                } else {
                                    setShowJoinModal(true);
                                }
                            }}
                            className="flex items-center gap-2 min-w-0 text-left cursor-pointer group active:scale-[0.98] transition-transform rounded-xl pr-1 py-0.5 hover:bg-surface-container/60"
                            title={
                                isAuthenticated && (groups.length > 0 || formerGroups.length > 0)
                                    ? `${tripTitle} • Tap to switch or manage rooms`
                                    : `${tripTitle} • Tap to invite members / show QR code`
                            }
                            aria-label={
                                isAuthenticated && (groups.length > 0 || formerGroups.length > 0)
                                    ? 'Switch room'
                                    : 'Invite trip members'
                            }
                            aria-expanded={
                                isAuthenticated && (groups.length > 0 || formerGroups.length > 0)
                                    ? showRoomMenu
                                    : undefined
                            }
                        >
                            <div className="w-9 h-9 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center text-primary shadow-xs shrink-0 transition-colors">
                                <AppIcon name={tripIcon} className="text-[20px]" />
                            </div>
                            {/* Trip title & subtitle: Truncated cleanly on narrow screens, expanded on sm+ */}
                            <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-0.5">
                                    <span
                                        className="font-bold text-sm sm:text-base text-on-surface tracking-tight font-headline truncate max-w-[88px] sm:max-w-[148px] group-hover:text-primary transition-colors"
                                        title={tripTitle}
                                    >
                                        {tripTitle}
                                    </span>
                                    {isAuthenticated && (groups.length > 0 || formerGroups.length > 0) ? (
                                        <AppIcon
                                            name={showRoomMenu ? 'expand_less' : 'expand_more'}
                                            className="text-[16px] text-primary shrink-0 transition-transform"
                                        />
                                    ) : (
                                        <AppIcon name="qr_code_2" className="text-[14px] sm:text-[15px] text-primary/60 group-hover:text-primary transition-colors shrink-0" />
                                    )}
                                </div>
                                <span className="hidden sm:block text-[10px] text-primary font-semibold tracking-wider uppercase font-mono truncate">
                                    {isFormerActiveGroup
                                        ? 'Read-Only Archive'
                                        : (activeGroup?.status || '').toUpperCase() === 'CLOSED'
                                          ? 'Closed Room'
                                          : (activeGroup?.status || '').toUpperCase() === 'ARCHIVED'
                                            ? 'Archived Room'
                                            : tripSubtitle}
                                </span>
                            </div>
                        </button>

                        {/* 1-Tap Invite QR Button for Active Authenticated Room Members */}
                        {isAuthenticated && activeGroup && !isFormerActiveGroup && (
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic('light');
                                    setShowRoomMenu(false);
                                    setShowJoinModal(true);
                                }}
                                className="w-7 h-7 rounded-lg bg-surface-container/80 hover:bg-primary/15 text-primary/80 hover:text-primary flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                                title="Show room invite QR code"
                                aria-label="Show invite QR code"
                            >
                                <AppIcon name="qr_code_2" className="text-[16px]" />
                            </button>
                        )}

                        {/* Connection Dot */}
                        <button
                            type="button"
                            onClick={() => refetchTripInfo()}
                            className="inline-flex items-center p-0.5 rounded-full hover:bg-surface-container transition-colors cursor-pointer group shrink-0"
                            title={
                                !isOnline
                                    ? 'Offline • Showing cached data'
                                    : isHealthy
                                    ? 'Connected to API • Tap to refresh trip title'
                                    : 'Checking API connection'
                            }
                            aria-label="Refresh trip info"
                        >
                            <span
                                className={`w-2 h-2 rounded-full shrink-0 transition-transform group-hover:scale-125 ${
                                    isTripInfoFetching
                                        ? 'bg-primary animate-ping'
                                        : isHealthy
                                        ? 'bg-primary animate-pulse'
                                        : 'bg-tertiary'
                                }`}
                            />
                        </button>
                    </div>

                    {/* 1-Tap Room Switcher Dropdown Popover */}
                    {showRoomMenu && isAuthenticated && (groups.length > 0 || formerGroups.length > 0) && (
                        <div
                            className="absolute left-4 top-[calc(100%-2px)] w-[min(320px,calc(100vw-2rem))] rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                            role="menu"
                            aria-label="Room Switcher"
                        >
                            <div className="px-3.5 py-2.5 bg-surface-container-low/70 border-b border-outline-variant/20 flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant font-mono">
                                    Your Rooms ({groups.length})
                                </span>
                                <span className="text-[10px] text-primary font-semibold">
                                    Tap to switch
                                </span>
                            </div>

                            <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
                                {groups.map((g) => {
                                    const isActive = g.groupId === activeGroup?.groupId;
                                    return (
                                        <button
                                            key={g.groupId}
                                            type="button"
                                            role="menuitem"
                                            onClick={() => {
                                                triggerHaptic('light');
                                                setShowRoomMenu(false);
                                                if (!isActive) {
                                                    setActiveGroupId(g.groupId);
                                                    showToast(`Switched to "${g.name}"`, g.icon || 'groups');
                                                }
                                            }}
                                            className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                                                isActive
                                                    ? 'bg-primary/10 text-on-surface'
                                                    : 'hover:bg-surface-container text-on-surface'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div
                                                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                                        isActive
                                                            ? 'bg-primary text-on-primary'
                                                            : 'bg-surface-container text-primary'
                                                    }`}
                                                >
                                                    <AppIcon name={g.icon || 'groups'} className="text-[17px]" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-xs font-bold truncate">
                                                            {g.name}
                                                        </span>
                                                        <span
                                                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                                                                g.isOwner
                                                                    ? 'bg-secondary-fixed text-on-secondary-fixed'
                                                                    : 'bg-surface-container-high text-on-surface-variant'
                                                            }`}
                                                        >
                                                            {g.isOwner ? 'Owner' : 'Member'}
                                                        </span>
                                                        {(g.status || 'ACTIVE').toUpperCase() !==
                                                            'ACTIVE' && (
                                                            <span
                                                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                                                                    (
                                                                        g.status || ''
                                                                    ).toUpperCase() === 'ARCHIVED'
                                                                        ? 'bg-tertiary/10 text-tertiary border border-tertiary/25'
                                                                        : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30'
                                                                }`}
                                                            >
                                                                {(
                                                                    g.status || ''
                                                                ).toUpperCase() === 'ARCHIVED'
                                                                    ? 'Archived'
                                                                    : 'Closed'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-on-surface-variant block truncate">
                                                        {g.memberCount} members • as {g.myMemberName || user?.name}
                                                    </span>
                                                </div>
                                            </div>
                                            {isActive && (
                                                <AppIcon
                                                    name="check_circle"
                                                    className="text-[17px] text-primary shrink-0"
                                                />
                                            )}
                                        </button>
                                    );
                                })}

                                {formerGroups.length > 0 && (
                                    <div className="pt-1.5 mt-1 border-t border-outline-variant/20 space-y-1">
                                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-on-surface-variant block">
                                            Past Rooms (Read-Only)
                                        </span>
                                        {formerGroups.map((g) => {
                                            const isActive = g.groupId === activeGroup?.groupId;
                                            return (
                                                <button
                                                    key={g.groupId}
                                                    type="button"
                                                    role="menuitem"
                                                    onClick={() => {
                                                        triggerHaptic('light');
                                                        setShowRoomMenu(false);
                                                        if (!isActive) {
                                                            setActiveGroupId(g.groupId);
                                                            showToast(
                                                                `Viewing archived history for "${g.name}"`,
                                                                'schedule'
                                                            );
                                                        }
                                                    }}
                                                    className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                                                        isActive
                                                            ? 'bg-primary/10 text-on-surface'
                                                            : 'hover:bg-surface-container text-on-surface'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className="w-8 h-8 rounded-xl bg-surface-container text-on-surface-variant flex items-center justify-center shrink-0">
                                                            <AppIcon name={g.icon || 'groups'} className="text-[17px]" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs font-bold truncate">
                                                                    {g.name}
                                                                </span>
                                                                <span className="px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface-variant text-[9px] font-bold shrink-0">
                                                                    Read-Only
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] text-on-surface-variant block truncate">
                                                                As {g.myMemberName || user?.name} •{' '}
                                                                {g.leftReason === 'REMOVED'
                                                                    ? 'Removed'
                                                                    : 'Left'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {isActive && (
                                                        <AppIcon
                                                            name="check_circle"
                                                            className="text-[17px] text-primary shrink-0"
                                                        />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="p-2 border-t border-outline-variant/20 bg-surface-container-low/50 grid grid-cols-2 gap-1.5">
                                {!isFormerActiveGroup && activeGroup ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic('light');
                                            setShowRoomMenu(false);
                                            setShowJoinModal(true);
                                        }}
                                        className="h-9 px-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <AppIcon name="qr_code_2" className="text-[15px] text-primary" />
                                        <span>Invite QR</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic('light');
                                            setShowRoomMenu(false);
                                            setActiveTab('splits');
                                        }}
                                        className="h-9 px-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <AppIcon name="pie_chart" className="text-[15px] text-primary" />
                                        <span>Past Splits</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic('light');
                                        setShowRoomMenu(false);
                                        setActiveTab('groups');
                                    }}
                                    className="h-9 px-2.5 rounded-xl bg-primary/12 hover:bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <AppIcon name="groups" className="text-[15px]" />
                                    <span>Manage Rooms</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Active Member Switcher / Claim Button & Offline Sync Status */}
                    <div className="flex items-center gap-1.5">
                        {/* Offline / Pending Queue Pill -> Tapping opens Sync Operations modal */}
                        {(!isOnline || pendingCount > 0) && (
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic('light');
                                    setShowSyncModal(true);
                                }}
                                className={`h-8 px-2.5 rounded-full border text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
                                    !isOnline
                                        ? 'bg-tertiary-container/30 border-tertiary/40 text-tertiary'
                                        : isSyncing
                                        ? 'bg-primary-fixed/40 border-primary/40 text-primary animate-pulse'
                                        : hasBackoff
                                        ? 'bg-indigo-500/15 border-indigo-500/35 text-indigo-700 dark:text-indigo-300'
                                        : 'bg-primary-fixed/40 border-primary/40 text-primary'
                                }`}
                                title="Tap to view sync status & per-split queue"
                            >
                                <AppIcon
                                    name={!isOnline
                                        ? 'cloud_off'
                                        : isSyncing
                                        ? 'sync'
                                        : hasBackoff
                                        ? 'timer'
                                        : 'cloud_queue'}
                                    className={`text-[14px] ${isSyncing ? 'animate-spin' : ''}`}
                                />
                                <span>
                                    {!isOnline
                                        ? pendingCount > 0
                                            ? `${pendingCount} queued`
                                            : 'Offline'
                                        : isSyncing
                                        ? 'Syncing'
                                        : hasBackoff
                                        ? `${pendingCount} wait`
                                        : `${pendingCount} sync`}
                                </span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setShowSwitcher(!showSwitcher)}
                            className={`h-9 px-3 rounded-full flex items-center gap-2 text-on-surface transition-colors cursor-pointer border text-xs font-semibold ${
                                isSwitcherUnlocked
                                    ? 'bg-primary-fixed/35 border-primary/40 text-on-primary-fixed shadow-xs'
                                    : isDeviceClaimed
                                    ? 'bg-surface-container hover:bg-surface-container-high border-outline-variant/30'
                                    : 'bg-primary/10 border-primary/40 text-primary animate-pulse'
                            }`}
                            title={
                                isSwitcherUnlocked
                                    ? `Admin Mode Active • Viewing as ${activePerson}`
                                    : isDeviceClaimed
                                    ? `Device bound to ${claimedPerson}`
                                    : 'Claim your profile'
                            }
                        >
                            <div className="relative flex items-center">
                                <Avatar name={activePerson} size="sm" />
                                {isSwitcherUnlocked ? (
                                    <span
                                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-on-primary ring-1.5 ring-surface flex items-center justify-center shadow-2xs"
                                        title="Admin Mode Active"
                                    >
                                        <AppIcon name="admin_panel_settings" className="text-[9px] leading-none" />
                                    </span>
                                ) : isDeviceClaimed ? (
                                    <span
                                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-secondary text-on-secondary ring-1.5 ring-surface flex items-center justify-center shadow-2xs"
                                        title={`Device locked to ${claimedPerson}`}
                                    >
                                        <AppIcon name="lock" className="text-[8.5px] leading-none" />
                                    </span>
                                ) : null}
                            </div>
                            <span className="truncate max-w-[85px]">
                                {activePerson} {isSwitcherUnlocked ? '(Admin)' : isDeviceClaimed ? '(You)' : ''}
                            </span>
                            <AppIcon name="arrow_drop_down" className="text-on-surface-variant text-[16px]" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Quick Switcher / Device Claim Modal */}
            <ProfileModal
                isOpen={showSwitcher}
                onClose={() => setShowSwitcher(false)}
                people={people}
                activePerson={activePerson}
                claimedPerson={claimedPerson}
                isDeviceClaimed={isDeviceClaimed}
                isSwitcherUnlocked={isSwitcherUnlocked}
                claimProfile={claimProfile}
                setActivePerson={setActivePerson}
                unlockProfileSwitch={unlockProfileSwitch}
                unclaimDevice={unclaimDevice}
                lockSwitcher={lockSwitcher}
                showToast={showToast}
                onOpenSyncStatus={() => setShowSyncModal(true)}
                onOpenSpendHistory={() => setShowSpendHistory(true)}
                onOpenAdminConsole={() => setActiveTab('admin')}
                user={user}
                isAuthenticated={isAuthenticated}
                activeGroup={activeGroup}
                groupsCount={groups.length + formerGroups.length}
                onOpenGroups={() => setActiveTab('groups')}
                onLogoutUser={logoutUser}
            />

            {/* Join Trip / Invite Members QR Modal */}
            <JoinTripModal
                key={activeGroup?.groupId || 'default'}
                isOpen={showJoinModal}
                onClose={() => setShowJoinModal(false)}
                tripTitle={tripTitle}
                tripSubtitle={tripSubtitle}
                tripIcon={tripIcon}
            />

            {/* Offline Sync Operations & Queue Transparency Modal */}
            <SyncStatusModal
                isOpen={showSyncModal}
                onClose={() => setShowSyncModal(false)}
            />

            {/* Dedicated Month-wise Spend History Breakdown Modal */}
            <SpendHistoryModal
                isOpen={showSpendHistory}
                onClose={() => setShowSpendHistory(false)}
                initialPerson={activePerson}
                claimedPerson={claimedPerson}
            />
        </>
    );
};

export default Header;
