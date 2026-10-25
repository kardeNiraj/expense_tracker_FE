import React, { useState } from 'react';
import { Avatar } from '../Avatar';
import { ENV } from '../../config';

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
}) => {
    const [passcodeInput, setPasscodeInput] = useState('');
    const [unlockError, setUnlockError] = useState(false);

    if (!isOpen) return null;

    const handleUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        const success = unlockProfileSwitch(passcodeInput);
        if (success) {
            setUnlockError(false);
            setPasscodeInput('');
            showToast('Profile switcher unlocked!', 'lock_open');
        } else {
            setUnlockError(true);
            showToast('Incorrect admin passcode', 'error');
        }
    };

    const handleUnclaim = () => {
        const success = unclaimDevice(passcodeInput || ENV.ADMIN_PASSCODE);
        if (success) {
            setUnlockError(false);
            setPasscodeInput('');
            showToast('Device profile released', 'lock_reset');
            onClose();
        } else {
            setUnlockError(true);
            showToast('Enter admin passcode to unclaim device', 'error');
        }
    };

    const handleClose = () => {
        setUnlockError(false);
        setPasscodeInput('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40 backdrop-blur-xs">
            <div className="fixed inset-0" onClick={handleClose} aria-hidden="true" />
            <div className="relative z-10 w-full max-w-sm bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-2xl space-y-3">
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-outline-variant/20">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[20px]">
                            {isDeviceClaimed && !isSwitcherUnlocked ? 'lock' : 'switch_account'}
                        </span>
                        <div>
                            <h3 className="font-semibold text-sm text-on-surface">
                                {isDeviceClaimed
                                    ? isSwitcherUnlocked
                                        ? 'Switch Member Profile'
                                        : 'Device Profile Locked'
                                    : 'Claim This Device'}
                            </h3>
                            <p className="text-[11px] text-on-surface-variant">
                                {isDeviceClaimed
                                    ? isSwitcherUnlocked
                                        ? 'Admin unlocked: select viewer'
                                        : `Bound to ${claimedPerson}`
                                    : 'Select your name to lock your identity'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                </div>

                {/* CASE 1: Device is claimed and switcher is LOCKED -> Prompt for Admin Passcode */}
                {isDeviceClaimed && !isSwitcherUnlocked && (
                    <form onSubmit={handleUnlock} className="space-y-3 py-1">
                        <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface-variant space-y-1.5">
                            <div className="flex items-center gap-1.5 font-bold text-on-surface">
                                <span className="material-symbols-outlined text-primary text-[16px]">
                                    security
                                </span>
                                <span>Protected Device Profile</span>
                            </div>
                            <p>
                                This device is registered to <strong className="text-on-surface">{claimedPerson}</strong> so other users cannot accidentally or maliciously settle debts on your behalf.
                            </p>
                            <p className="text-[11px]">
                                Enter the admin passcode to unlock and switch profiles.
                            </p>
                        </div>

                        <div>
                            <label htmlFor="admin-passcode-input" className="text-xs font-semibold text-on-surface-variant block mb-1">
                                Admin Passcode
                            </label>
                            <input
                                id="admin-passcode-input"
                                type="password"
                                value={passcodeInput}
                                onChange={(e) => {
                                    setPasscodeInput(e.target.value);
                                    setUnlockError(false);
                                }}
                                placeholder="Enter passcode (default: 1234)"
                                className={`w-full h-10 px-3 rounded-xl bg-surface-container-low text-sm font-mono text-on-surface border focus:outline-none ${
                                    unlockError
                                        ? 'border-error focus:border-error'
                                        : 'border-outline-variant/30 focus:border-primary'
                                }`}
                                autoFocus
                                required
                            />
                            {unlockError && (
                                <span className="text-[11px] text-error mt-1 block">
                                    Incorrect passcode. Try again or check with trip admin.
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="h-9 px-3 rounded-xl bg-surface-container text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 h-9 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer shadow-xs"
                            >
                                Unlock Switcher
                            </button>
                        </div>
                    </form>
                )}

                {/* CASE 2: Device is NOT claimed OR Switcher is UNLOCKED -> Show Member List */}
                {(!isDeviceClaimed || isSwitcherUnlocked) && (
                    <div className="space-y-2">
                        {isSwitcherUnlocked && (
                            <div className="flex items-center justify-between p-2 rounded-xl bg-primary/10 border border-primary/20 text-xs">
                                <div className="flex items-center gap-1.5 text-primary font-semibold">
                                    <span className="material-symbols-outlined text-[15px]">
                                        lock_open
                                    </span>
                                    <span>Admin Mode Active</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={handleUnclaim}
                                        className="px-2 py-0.5 rounded text-[11px] font-semibold text-error hover:bg-error/10 cursor-pointer"
                                        title="Unclaim profile from this device"
                                    >
                                        Release Device
                                    </button>
                                    <button
                                        type="button"
                                        onClick={lockSwitcher}
                                        className="px-2 py-0.5 rounded text-[11px] font-bold text-primary hover:bg-primary/20 cursor-pointer"
                                        title="Re-lock profile switcher"
                                    >
                                        Lock
                                    </button>
                                </div>
                            </div>
                        )}

                        {!isDeviceClaimed && (
                            <p className="text-[11px] text-on-surface-variant px-1">
                                Tap your name below to claim this phone as your personal device.
                            </p>
                        )}

                        <div className="space-y-1.5 max-h-[260px] overflow-y-auto no-scrollbar">
                            {people.map((person) => {
                                const isCurrent = person === activePerson;
                                return (
                                    <button
                                        key={person}
                                        type="button"
                                        onClick={() => {
                                            if (!isDeviceClaimed) {
                                                claimProfile(person);
                                                showToast(`Device claimed as ${person}!`, 'verified_user');
                                            } else {
                                                setActivePerson(person);
                                                showToast(`Switched view to ${person}`);
                                            }
                                            handleClose();
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
                                                    {!isDeviceClaimed
                                                        ? 'Tap to claim as your profile'
                                                        : isCurrent
                                                        ? 'Current viewer'
                                                        : 'Tap to view as ' + person}
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
                )}
            </div>
        </div>
    );
};
