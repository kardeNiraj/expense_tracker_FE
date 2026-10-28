import React, { useState } from 'react';
import { useExpense } from '../../context';
import { usePeople, useHealthCheck, useTripInfo } from '../../api';
import { Avatar } from '../Avatar';
import { ENV } from '../../config';
import { ProfileModal } from './ProfileModal';
import { JoinTripModal } from './JoinTripModal';
import { useOfflineSync } from '../../utils/useOfflineSync';
import { triggerHaptic } from '../../utils/haptics';

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
        showToast,
    } = useExpense();

    const { data: people = [] } = usePeople();
    const { data: health } = useHealthCheck();
    const { data: tripInfo, refetch: refetchTripInfo, isFetching: isTripInfoFetching } = useTripInfo();
    const { isOnline, pendingCount, isSyncing, syncNow } = useOfflineSync();
    const [showSwitcher, setShowSwitcher] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);

    const isHealthy = health?.status === 'healthy';
    const tripTitle = tripInfo?.title || ENV.DEFAULT_TRIP_TITLE;
    const tripSubtitle = tripInfo?.subtitle || ENV.DEFAULT_TRIP_SUBTITLE;
    const tripIcon = tripInfo?.icon || ENV.DEFAULT_TRIP_ICON;

    return (
        <>
            <header className="fixed top-0 inset-x-0 z-50 pt-safe bg-surface/90 backdrop-blur-xl border-b border-outline-variant/20 shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
                <div className="max-w-md mx-auto h-16 px-4 flex items-center justify-between gap-2">
                    {/* Brand / Trip Title - Tap to open Join Trip QR Modal */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic('light');
                                setShowJoinModal(true);
                            }}
                            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group active:scale-[0.98] transition-transform"
                            title="Tap to invite members / show QR code"
                            aria-label="Invite trip members"
                        >
                            <div className="w-9 h-9 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center text-primary shadow-xs shrink-0 transition-colors">
                                <span className="material-symbols-outlined text-[20px]">
                                    {tripIcon}
                                </span>
                            </div>
                            <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1">
                                    <span
                                        className="font-bold text-base text-on-surface tracking-tight font-headline truncate max-w-[155px] xs:max-w-[190px] sm:max-w-none group-hover:text-primary transition-colors"
                                        title={tripTitle}
                                    >
                                        {tripTitle}
                                    </span>
                                    <span className="material-symbols-outlined text-[15px] text-primary/50 group-hover:text-primary transition-colors">
                                        qr_code_2
                                    </span>
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
                            title={isHealthy ? 'Connected to API • Tap to refresh trip title' : 'Checking API connection'}
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
                        {/* Offline / Pending Queue Pill */}
                        {(!isOnline || pendingCount > 0) && (
                            <button
                                type="button"
                                onClick={() => syncNow()}
                                disabled={isSyncing || !isOnline}
                                className={`h-8 px-2.5 rounded-full border text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
                                    !isOnline
                                        ? 'bg-tertiary-container/30 border-tertiary/40 text-tertiary'
                                        : 'bg-primary-fixed/40 border-primary/40 text-primary animate-pulse'
                                }`}
                                title={
                                    !isOnline
                                        ? 'Offline mode: New entries save locally and will sync when connection returns'
                                        : 'Tap to sync pending offline records now'
                                }
                            >
                                <span className={`material-symbols-outlined text-[14px] ${isSyncing ? 'animate-spin' : ''}`}>
                                    {!isOnline ? 'cloud_off' : isSyncing ? 'sync' : 'cloud_upload'}
                                </span>
                                <span>
                                    {!isOnline
                                        ? pendingCount > 0
                                            ? `${pendingCount} queued`
                                            : 'Offline'
                                        : `${pendingCount} sync`}
                                </span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setShowSwitcher(!showSwitcher)}
                            className={`h-9 px-3 rounded-full flex items-center gap-2 text-on-surface transition-colors cursor-pointer border text-xs font-semibold ${
                                isDeviceClaimed
                                    ? 'bg-surface-container hover:bg-surface-container-high border-outline-variant/30'
                                    : 'bg-primary/10 border-primary/40 text-primary animate-pulse'
                            }`}
                            title={isDeviceClaimed ? 'Device bound to ' + activePerson : 'Claim your profile'}
                        >
                            <div className="relative flex items-center">
                                <Avatar name={activePerson} size="sm" />
                                {isDeviceClaimed && (
                                    <span
                                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-on-primary ring-1.5 ring-surface flex items-center justify-center shadow-2xs"
                                        title="Profile locked to this device"
                                    >
                                        <span className="material-symbols-outlined text-[8.5px] leading-none">lock</span>
                                    </span>
                                )}
                            </div>
                            <span className="truncate max-w-[80px]">
                                {activePerson} {isDeviceClaimed ? '(You)' : ''}
                            </span>
                            <span className="material-symbols-outlined text-on-surface-variant text-[16px]">
                                arrow_drop_down
                            </span>
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
            />

            {/* Join Trip / Invite Members QR Modal */}
            <JoinTripModal
                isOpen={showJoinModal}
                onClose={() => setShowJoinModal(false)}
                tripTitle={tripTitle}
                tripSubtitle={tripSubtitle}
                tripIcon={tripIcon}
            />
        </>
    );
};

export default Header;
