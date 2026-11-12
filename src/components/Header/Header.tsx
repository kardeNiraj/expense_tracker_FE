import React, { useState } from 'react';
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
        activePerson,
        setActivePerson,
        claimedPerson,
        isDeviceClaimed,
        claimProfile,
        unlockProfileSwitch,
        unclaimDevice,
        isSwitcherUnlocked,
        lockSwitcher,
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
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [showSpendHistory, setShowSpendHistory] = useState(false);

    const isHealthy = isOnline && !isTripInfoError && (Boolean(tripInfo) || people.length > 0);
    const tripTitle = tripInfo?.title || ENV.DEFAULT_TRIP_TITLE;
    const tripSubtitle = tripInfo?.subtitle || ENV.DEFAULT_TRIP_SUBTITLE;
    const tripIcon = tripInfo?.icon || ENV.DEFAULT_TRIP_ICON;

    return (
        <>
            <header className="fixed top-0 inset-x-0 z-40 pt-safe bg-surface/90 backdrop-blur-xl border-b border-outline-variant/20 shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
                <div className="max-w-md mx-auto h-16 px-4 flex items-center justify-between gap-2">
                    {/* Brand / Trip Icon - Tap to open Join Trip QR Modal */}
                    <div className="flex items-center gap-2 min-w-0">
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic('light');
                                setShowJoinModal(true);
                            }}
                            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group active:scale-[0.98] transition-transform"
                            title={`${tripTitle} • Tap to invite members / show QR code`}
                            aria-label="Invite trip members"
                        >
                            <div className="w-9 h-9 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center text-primary shadow-xs shrink-0 transition-colors">
                                <AppIcon name={tripIcon} className="text-[20px]" />
                            </div>
                            {/* Trip title & subtitle: Hidden on mobile to avoid squashing offline & profile chips, visible on sm: screens */}
                            <div className="hidden sm:flex flex-col min-w-0">
                                <div className="flex items-center gap-1">
                                    <span
                                        className="font-bold text-base text-on-surface tracking-tight font-headline truncate max-w-[155px] group-hover:text-primary transition-colors"
                                        title={tripTitle}
                                    >
                                        {tripTitle}
                                    </span>
                                    <AppIcon name="qr_code_2" className="text-[15px] text-primary/50 group-hover:text-primary transition-colors" />
                                </div>
                                <span className="text-[10px] text-primary font-semibold tracking-wider uppercase font-mono truncate">
                                    {tripSubtitle}
                                </span>
                            </div>
                        </button>

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
            />

            {/* Join Trip / Invite Members QR Modal */}
            <JoinTripModal
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
