import React, { useState } from 'react';
import { Avatar } from '../Avatar';
import { ENV } from '../../config';
import { triggerHaptic } from '../../utils/haptics';
import { reloadApp } from '../../utils/pwaReload';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    people: string[];
    activePerson: string;
    claimedPerson: string | null;
    isDeviceClaimed: boolean;
    isSwitcherUnlocked: boolean;
    claimProfile: (name: string) => void;
    setActivePerson: (name: string) => void;
    unlockProfileSwitch: (passcode: string) => boolean;
    unclaimDevice: (passcode: string) => boolean;
    lockSwitcher: () => void;
    showToast: (message: string, icon?: string) => void;
    onOpenSyncStatus?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
    isOpen,
    onClose,
    people,
    activePerson,
    claimedPerson,
    isDeviceClaimed,
    isSwitcherUnlocked,
    claimProfile,
    setActivePerson,
    unlockProfileSwitch,
    unclaimDevice,
    lockSwitcher,
    showToast,
    onOpenSyncStatus,
}) => {
    const [passcodeInput, setPasscodeInput] = useState('');
    const [unlockError, setUnlockError] = useState(false);

    if (!isOpen) return null;

    const handleUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        const success = unlockProfileSwitch(passcodeInput);
        if (success) {
            triggerHaptic('success');
            setUnlockError(false);
            setPasscodeInput('');
            showToast('Admin Mode unlocked! You can switch viewers freely.', 'lock_open');
        } else {
            triggerHaptic('warning');
            setUnlockError(true);
            showToast('Incorrect admin passcode', 'error');
        }
    };

    const handleReleaseDevice = () => {
        const success = unclaimDevice(ENV.ADMIN_PASSCODE);
        if (success) {
            triggerHaptic('medium');
            showToast('Device binding released', 'lock_reset');
        } else {
            triggerHaptic('warning');
            showToast('Failed to release device', 'error');
        }
    };

    const handleLockAndExit = () => {
        triggerHaptic('light');
        lockSwitcher();
        showToast('Admin mode locked', 'lock');
        onClose();
    };

    const handleClose = () => {
        setUnlockError(false);
        setPasscodeInput('');
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={handleClose}
        >
            <div
                className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl border border-outline-variant/30 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Drag Handle (Mobile) */}
                <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
                    <div className="w-10 h-1 rounded-full bg-outline-variant/60" />
                </div>

                {/* Modal Header */}
                <div className="p-4 border-b border-outline-variant/20 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <span className="material-symbols-outlined text-[20px]">
                                {isSwitcherUnlocked
                                    ? 'admin_panel_settings'
                                    : isDeviceClaimed
                                    ? 'verified_user'
                                    : 'switch_account'}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-base text-on-surface truncate">
                                {isSwitcherUnlocked
                                    ? 'Admin Profile Switcher'
                                    : isDeviceClaimed
                                    ? 'Member Profile'
                                    : 'Claim This Device'}
                            </h3>
                            <p className="text-xs text-on-surface-variant truncate">
                                {isSwitcherUnlocked
                                    ? `Admin Active • Current: ${activePerson}`
                                    : isDeviceClaimed
                                    ? `Bound to ${claimedPerson}`
                                    : 'Select your name to bind this device'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer shrink-0"
                        title="Close"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-4 overflow-y-auto overscroll-contain flex-1 space-y-3">
                    {/* CASE 1: Device is claimed and switcher is LOCKED -> Prompt for Admin Passcode */}
                    {isDeviceClaimed && !isSwitcherUnlocked && (
                        <form onSubmit={handleUnlock} className="space-y-3.5 py-1">
                            <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-2">
                                <div className="flex items-center gap-2.5">
                                    <Avatar name={claimedPerson || activePerson} size="md" />
                                    <div>
                                        <div className="font-bold text-sm text-on-surface flex items-center gap-1.5">
                                            <span>{claimedPerson}</span>
                                            <span className="material-symbols-outlined text-primary text-[15px]">
                                                lock
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-on-surface-variant">
                                            This device is locked to your profile to prevent unauthorized settlements.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label
                                    htmlFor="admin-passcode-input"
                                    className="text-xs font-semibold text-on-surface-variant block"
                                >
                                    Enter Admin Passcode to Switch
                                </label>
                                <input
                                    id="admin-passcode-input"
                                    type="password"
                                    inputMode="numeric"
                                    value={passcodeInput}
                                    onChange={(e) => {
                                        setPasscodeInput(e.target.value);
                                        setUnlockError(false);
                                    }}
                                    placeholder="Enter admin passcode (default: 1234)"
                                    className={`w-full h-11 px-3.5 rounded-xl bg-surface-container-lowest text-sm font-mono text-on-surface border focus:outline-hidden ${
                                        unlockError
                                            ? 'border-error focus:border-error'
                                            : 'border-outline-variant focus:border-primary'
                                    }`}
                                    required
                                />
                                {unlockError && (
                                    <span className="text-[11px] text-error font-medium block">
                                        Incorrect passcode. Try again or check with trip admin.
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="h-11 px-4 rounded-xl border border-outline-variant/40 text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 h-11 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                                >
                                    <span className="material-symbols-outlined text-[16px]">
                                        lock_open
                                    </span>
                                    <span>Unlock Switcher</span>
                                </button>
                            </div>
                        </form>
                    )}

                    {/* CASE 2: Switcher is UNLOCKED (Admin Mode) OR Device is Unclaimed */}
                    {(!isDeviceClaimed || isSwitcherUnlocked) && (
                        <div className="space-y-3">
                            {/* Admin Mode Status Banner */}
                            {isSwitcherUnlocked && (
                                <div className="p-3 rounded-2xl bg-primary-fixed/25 border border-primary/30 flex items-center justify-between text-xs gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="material-symbols-outlined text-primary text-[18px] shrink-0">
                                            admin_panel_settings
                                        </span>
                                        <div className="min-w-0">
                                            <span className="font-bold text-on-surface block truncate">
                                                Admin Mode Active
                                            </span>
                                            <span className="text-[11px] text-on-surface-variant truncate block">
                                                Tap any member to switch active view
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                        {isDeviceClaimed && (
                                            <button
                                                type="button"
                                                onClick={handleReleaseDevice}
                                                className="px-2 py-1 rounded-lg text-[11px] font-semibold text-error hover:bg-error/10 border border-error/20 cursor-pointer"
                                                title="Unbind profile from this device"
                                            >
                                                Unbind
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleLockAndExit}
                                            className="px-2 py-1 rounded-lg text-[11px] font-bold bg-primary text-on-primary hover:bg-primary/90 cursor-pointer"
                                            title="Lock switcher and exit admin mode"
                                        >
                                            Lock
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!isDeviceClaimed && !isSwitcherUnlocked && (
                                <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface-variant">
                                    Tap your name below to claim this phone as your personal device.
                                </div>
                            )}

                            {/* Scrollable Member List */}
                            <div className="space-y-2 max-h-[55vh] overflow-y-auto overscroll-contain pr-1">
                                {people.map((person) => {
                                    const isCurrent = person.toLowerCase() === activePerson.toLowerCase();
                                    const isOwner = person.toLowerCase() === (claimedPerson || '').toLowerCase();

                                    return (
                                        <div
                                            key={person}
                                            className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                                                isCurrent
                                                    ? 'bg-primary/5 border-primary/40 shadow-xs'
                                                    : 'bg-surface-container-low/70 border-outline-variant/20 hover:border-outline-variant/50 hover:bg-surface-container-low'
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    triggerHaptic('light');
                                                    if (!isDeviceClaimed && !isSwitcherUnlocked) {
                                                        claimProfile(person);
                                                        showToast(`Device claimed as ${person}!`, 'verified_user');
                                                        handleClose();
                                                    } else {
                                                        setActivePerson(person);
                                                        showToast(`Switched active view to ${person}`);
                                                        handleClose();
                                                    }
                                                }}
                                                className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                                            >
                                                <Avatar name={person} size="md" />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-bold text-sm text-on-surface truncate">
                                                            {person}
                                                        </span>
                                                        {isCurrent && (
                                                            <span className="px-1.5 py-0.2 rounded-md bg-primary-fixed text-on-primary-fixed text-[10px] font-bold">
                                                                Active Viewer
                                                            </span>
                                                        )}
                                                        {isOwner && (
                                                            <span className="px-1.5 py-0.2 rounded-md bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold flex items-center gap-0.5">
                                                                <span className="material-symbols-outlined text-[10px]">lock</span>
                                                                <span>Device Owner</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[11px] text-on-surface-variant block mt-0.5">
                                                        {!isDeviceClaimed && !isSwitcherUnlocked
                                                            ? 'Tap to claim device'
                                                            : isCurrent
                                                            ? 'Currently viewing this profile'
                                                            : 'Tap to view as ' + person}
                                                    </span>
                                                </div>
                                            </button>

                                            {/* Admin: Set as Device Owner Option */}
                                            {isSwitcherUnlocked && !isOwner && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        triggerHaptic('success');
                                                        claimProfile(person);
                                                        showToast(`Device rebound to ${person}!`, 'verified_user');
                                                    }}
                                                    className="px-2 py-1 rounded-lg text-[10px] font-semibold text-primary hover:bg-primary/10 border border-primary/20 shrink-0 cursor-pointer"
                                                    title={`Set ${person} as the permanent device owner`}
                                                >
                                                    Set Owner
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Bar: Sync Status, PWA Reload & Close */}
                <div className="p-3 border-t border-outline-variant/20 bg-surface-container-lowest shrink-0 space-y-2">
                    {onOpenSyncStatus && (
                        <div className="flex items-center justify-between text-xs px-0.5 pb-1 border-b border-outline-variant/15">
                            <div className="flex items-center gap-1.5 text-on-surface-variant min-w-0">
                                <span className="material-symbols-outlined text-primary text-[17px] shrink-0">
                                    cloud_sync
                                </span>
                                <div className="min-w-0">
                                    <span className="font-bold text-on-surface block text-[11px] leading-tight">
                                        Offline Sync & Queues
                                    </span>
                                    <span className="text-[10px] text-on-surface-variant block truncate">
                                        Per-split queues & backoff retries
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    handleClose();
                                    onOpenSyncStatus();
                                }}
                                className="h-8 px-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
                            >
                                <span>Status</span>
                                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                            </button>
                        </div>
                    )}

                    <div className="flex items-center justify-between text-xs px-0.5">
                        <div className="flex items-center gap-1.5 text-on-surface-variant min-w-0">
                            <span className="material-symbols-outlined text-primary text-[17px] shrink-0">
                                cached
                            </span>
                            <div className="min-w-0">
                                <span className="font-bold text-on-surface block text-[11px] leading-tight">
                                    App Version & PWA
                                </span>
                                <span className="text-[10px] text-on-surface-variant block truncate">
                                    Safe: Claims & offline queue are preserved
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                type="button"
                                onClick={() => reloadApp(false)}
                                className="h-8 px-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-primary text-xs font-bold border border-outline-variant/30 flex items-center gap-1 cursor-pointer transition-colors active:scale-95 shadow-2xs"
                                title="Check for SW updates and reload frontend"
                            >
                                <span className="material-symbols-outlined text-[15px]">
                                    refresh
                                </span>
                                <span>Reload</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => reloadApp(true)}
                                className="h-8 px-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium border border-outline-variant/20 flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
                                title="Purge static bundle cache and reload. Your user claim and offline data remain safe in localStorage."
                            >
                                <span className="material-symbols-outlined text-[15px] text-secondary">
                                    restart_alt
                                </span>
                                <span>Hard Reload</span>
                            </button>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleClose}
                        className="w-full h-10 rounded-xl bg-surface-container text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
