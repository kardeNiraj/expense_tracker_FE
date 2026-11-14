import React, { useState } from 'react';
import { Avatar } from '../Avatar';
import { triggerHaptic } from '../../utils/haptics';
import { reloadApp } from '../../utils/pwaReload';
import { ProfilePushControl } from './ProfilePushControl';
import type { ClaimActionResult } from '../../context/ExpenseContextDef';
import type { AuthUser, GroupSummary } from '../../api/types';
import { useUpdateProfileMutation } from '../../api';
import { AppIcon } from '../Icon/AppIcon';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    people: string[];
    activePerson: string;
    claimedPerson: string | null;
    isDeviceClaimed: boolean;
    isSwitcherUnlocked: boolean;
    claimProfile: (name: string) => Promise<ClaimActionResult>;
    setActivePerson: (name: string) => void;
    unlockProfileSwitch: (passcode: string) => Promise<boolean>;
    unclaimDevice: () => Promise<boolean>;
    lockSwitcher: () => void;
    showToast: (message: string, icon?: string) => void;
    onOpenSyncStatus?: () => void;
    onOpenSpendHistory?: () => void;
    onOpenAdminConsole?: () => void;
    user?: AuthUser | null;
    isAuthenticated?: boolean;
    activeGroup?: GroupSummary | null;
    groupsCount?: number;
    onOpenGroups?: () => void;
    onLogoutUser?: () => void;
    onOpenPrivacy?: () => void;
    onOpenTerms?: () => void;
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
    onOpenSpendHistory,
    onOpenAdminConsole,
    user,
    isAuthenticated = false,
    activeGroup,
    groupsCount = 0,
    onOpenGroups,
    onLogoutUser,
    onOpenPrivacy,
    onOpenTerms,
}) => {
    const [passcodeInput, setPasscodeInput] = useState('');
    const [unlockError, setUnlockError] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAdminUnlockForm, setShowAdminUnlockForm] = useState(false);

    const updateProfileMutation = useUpdateProfileMutation();
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [nameDraft, setNameDraft] = useState('');
    const [upiDraft, setUpiDraft] = useState('');
    const [profileEditError, setProfileEditError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleStartEditProfile = () => {
        setNameDraft(user?.name || activePerson || '');
        setUpiDraft(user?.upiId || '');
        setProfileEditError(null);
        setIsEditingProfile(true);
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanName = nameDraft.trim();
        if (cleanName.length < 2) {
            setProfileEditError('Display name must be at least 2 characters');
            return;
        }
        setProfileEditError(null);
        try {
            const result = await updateProfileMutation.mutateAsync({
                name: cleanName,
                upiId: upiDraft.trim() || null,
            });
            triggerHaptic('success');
            setIsEditingProfile(false);
            showToast(`Display name updated to ${result.user.name}`, 'badge');
            if (claimedPerson && user?.name && claimedPerson.toLowerCase() === user.name.toLowerCase()) {
                setActivePerson(result.user.name);
                void claimProfile(result.user.name);
            }
        } catch (err) {
            triggerHaptic('warning');
            setProfileEditError(err instanceof Error ? err.message : 'Failed to update profile');
        }
    };

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const success = await unlockProfileSwitch(passcodeInput);
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
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReleaseDevice = async () => {
        setIsSubmitting(true);
        try {
            const success = await unclaimDevice();
            if (success) {
                triggerHaptic('medium');
                showToast('Device binding released', 'lock_reset');
            } else {
                triggerHaptic('warning');
                showToast('Failed to release device', 'error');
            }
        } finally {
            setIsSubmitting(false);
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
        setShowAdminUnlockForm(false);
        setIsEditingProfile(false);
        setProfileEditError(null);
        onClose();
    };

    const handleLogoutClick = () => {
        triggerHaptic('medium');
        handleClose();
        onLogoutUser?.();
        showToast('Signed out of your SplitNest account', 'lock');
    };

    return (
        <div
            className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
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
                            <AppIcon
                                name={isSwitcherUnlocked
                                    ? 'admin_panel_settings'
                                    : isAuthenticated || isDeviceClaimed
                                        ? 'verified_user'
                                        : 'switch_account'}
                                className="text-[20px]"
                            />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-base text-on-surface truncate">
                                {isSwitcherUnlocked
                                    ? 'Admin Profile Switcher'
                                    : isAuthenticated
                                        ? 'Account & Active Room'
                                        : isDeviceClaimed
                                            ? 'Member Profile'
                                            : 'Claim This Device'}
                            </h3>
                            <p className="text-xs text-on-surface-variant truncate">
                                {isSwitcherUnlocked
                                    ? `Admin Active • Current: ${activePerson}`
                                    : isAuthenticated && user
                                        ? `${user.email || `${(user.authProvider || 'pin').toUpperCase()} account`} • ${activeGroup?.name || 'No active room'}${activeGroup?.isReadOnly ? ' (Read-Only)' : ''}`
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
                        <AppIcon name="close" className="text-[20px]" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-4 overflow-y-auto overscroll-contain flex-1 space-y-3">
                    {/* AUTHENTICATED USER CARD (when not in Admin Switcher mode) */}
                    {isAuthenticated && user && !isSwitcherUnlocked && (
                        <div className="space-y-3">
                            <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <Avatar name={activePerson || user.name || 'Member'} size="md" />
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-sm text-on-surface flex items-center gap-1.5 flex-wrap">
                                                <span className="truncate">{user.name || activePerson || 'Account'}</span>
                                                {!isEditingProfile && (
                                                    <button
                                                        type="button"
                                                        onClick={handleStartEditProfile}
                                                        className="w-5 h-5 rounded-md bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors cursor-pointer"
                                                        title="Edit display name and UPI ID"
                                                    >
                                                        <AppIcon name="edit" className="text-[12px]" />
                                                    </button>
                                                )}
                                                <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-bold uppercase">
                                                    {user.authProvider || 'pin'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-on-surface-variant truncate">
                                                {activeGroup
                                                    ? `In "${activeGroup.name}" as ${activeGroup.myMemberName || activePerson}${activeGroup.isOwner ? ' (Owner)' : activeGroup.isReadOnly ? ' (Archived • Read-Only)' : ''}`
                                                    : 'Join or create a room to track splits'}
                                            </p>
                                            {user.upiId && !isEditingProfile && (
                                                <p className="text-[10px] text-on-surface-variant flex items-center gap-1 mt-0.5">
                                                    <AppIcon name="account_balance_wallet" className="text-[12px] text-primary" />
                                                    <span className="font-mono">{user.upiId}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {onLogoutUser && (
                                        <button
                                            type="button"
                                            onClick={handleLogoutClick}
                                            className="px-2.5 py-1.5 rounded-xl bg-error/10 hover:bg-error/15 text-error text-[11px] font-bold cursor-pointer shrink-0 transition-colors"
                                        >
                                            Sign Out
                                        </button>
                                    )}
                                </div>

                                {/* Inline Profile Edit Form */}
                                {isEditingProfile && (
                                    <form
                                        onSubmit={handleSaveProfile}
                                        className="pt-2.5 border-t border-outline-variant/20 space-y-2.5 animate-in fade-in duration-150"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                                                <AppIcon name="badge" className="text-[14px] text-primary" />
                                                <span>Update Profile Info</span>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setIsEditingProfile(false)}
                                                className="text-[11px] text-on-surface-variant hover:text-on-surface cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-semibold text-on-surface-variant block mb-1">
                                                Display Name (how friends see you in rooms)
                                            </label>
                                            <input
                                                type="text"
                                                value={nameDraft}
                                                onChange={(e) => setNameDraft(e.target.value)}
                                                placeholder="e.g. Niraj"
                                                maxLength={60}
                                                className="w-full h-8 px-2.5 rounded-lg bg-surface-container border border-outline-variant/35 text-xs text-on-surface focus:outline-none focus:border-primary"
                                                autoFocus
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-semibold text-on-surface-variant block mb-1">
                                                UPI ID (for receiving settlements & quick payment QR)
                                            </label>
                                            <input
                                                type="text"
                                                value={upiDraft}
                                                onChange={(e) => setUpiDraft(e.target.value)}
                                                placeholder="e.g. niraj@okaxis (optional)"
                                                className="w-full h-8 px-2.5 rounded-lg bg-surface-container border border-outline-variant/35 text-xs text-on-surface focus:outline-none focus:border-primary font-mono text-[11px]"
                                            />
                                        </div>

                                        {profileEditError && (
                                            <p className="text-[11px] text-error flex items-center gap-1">
                                                <AppIcon name="error" className="text-[13px]" />
                                                <span>{profileEditError}</span>
                                            </p>
                                        )}

                                        <div className="flex items-center justify-end gap-2 pt-0.5">
                                            <button
                                                type="button"
                                                onClick={() => setIsEditingProfile(false)}
                                                className="px-2.5 h-7 rounded-lg border border-outline-variant/30 text-[11px] font-medium text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={updateProfileMutation.isPending}
                                                className="px-3 h-7 rounded-lg bg-primary text-on-primary text-[11px] font-bold hover:bg-primary/90 cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-60 shadow-xs"
                                            >
                                                {updateProfileMutation.isPending && (
                                                    <AppIcon name="progress_activity" className="text-[12px] animate-spin" />
                                                )}
                                                <span>{updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}</span>
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {onOpenGroups && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic('light');
                                            handleClose();
                                            onOpenGroups();
                                        }}
                                        className="w-full h-10 px-3 rounded-xl bg-primary text-on-primary text-xs font-bold flex items-center justify-between hover:bg-primary/90 transition-colors cursor-pointer shadow-xs"
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <AppIcon name="groups" className="text-[17px]" />
                                            <span>Switch or Manage Rooms ({groupsCount})</span>
                                        </span>
                                        <AppIcon name="arrow_forward" className="text-[15px]" />
                                    </button>
                                )}
                            </div>

                            {/* Optional Collapsible Admin Unlock */}
                            <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low/50 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowAdminUnlockForm((v) => !v)}
                                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <AppIcon name="admin_panel_settings" className="text-[16px] text-primary" />
                                        <span>Trip Admin Passcode Unlock</span>
                                    </span>
                                    <AppIcon
                                        name={showAdminUnlockForm ? 'expand_less' : 'expand_more'}
                                        className="text-[18px]"
                                    />
                                </button>
                                {showAdminUnlockForm && (
                                    <form onSubmit={handleUnlock} className="px-3.5 pb-3.5 pt-1 space-y-2 border-t border-outline-variant/15">
                                        <div className="flex items-center gap-2">
                                            <input
                                                id="admin-passcode-input"
                                                type="password"
                                                inputMode="numeric"
                                                value={passcodeInput}
                                                onChange={(e) => {
                                                    setPasscodeInput(e.target.value);
                                                    setUnlockError(false);
                                                }}
                                                placeholder="Admin passcode"
                                                className={`flex-1 h-10 px-3 rounded-xl bg-surface-container-lowest text-xs font-mono text-on-surface border focus:outline-hidden ${unlockError
                                                        ? 'border-error focus:border-error'
                                                        : 'border-outline-variant focus:border-primary'
                                                    }`}
                                                required
                                            />
                                            <button
                                                type="submit"
                                                disabled={isSubmitting}
                                                className="h-10 px-3.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 cursor-pointer disabled:opacity-60"
                                            >
                                                {isSubmitting ? '...' : 'Unlock'}
                                            </button>
                                        </div>
                                        {unlockError && (
                                            <span className="text-[11px] text-error font-medium block">
                                                Incorrect passcode.
                                            </span>
                                        )}
                                    </form>
                                )}
                            </div>
                        </div>
                    )}

                    {/* CASE 1 (Legacy unauthenticated): Device is claimed and switcher is LOCKED -> Prompt for Admin Passcode */}
                    {!isAuthenticated && isDeviceClaimed && !isSwitcherUnlocked && (
                        <form onSubmit={handleUnlock} className="space-y-3.5 py-1">
                            <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-2">
                                <div className="flex items-center gap-2.5">
                                    <Avatar name={claimedPerson || activePerson} size="md" />
                                    <div>
                                        <div className="font-bold text-sm text-on-surface flex items-center gap-1.5">
                                            <span>{claimedPerson}</span>
                                            <AppIcon name="lock" className="text-primary text-[15px]" />
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
                                    placeholder="Enter admin passcode"
                                    className={`w-full h-11 px-3.5 rounded-xl bg-surface-container-lowest text-sm font-mono text-on-surface border focus:outline-hidden ${unlockError
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
                                    disabled={isSubmitting}
                                    className="flex-1 h-11 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-60 shadow-xs flex items-center justify-center gap-1.5"
                                >
                                    <AppIcon name="lock_open" className="text-[16px]" />
                                    <span>{isSubmitting ? 'Verifying...' : 'Unlock Switcher'}</span>
                                </button>
                            </div>
                        </form>
                    )}

                    {/* CASE 2: Switcher is UNLOCKED (Admin Mode) OR Legacy Unclaimed Device */}
                    {((!isAuthenticated && !isDeviceClaimed) || isSwitcherUnlocked) && (
                        <div className="space-y-3">
                            {/* Admin Mode Status Banner */}
                            {isSwitcherUnlocked && (
                                <div className="p-3 rounded-2xl bg-primary-fixed/25 border border-primary/30 flex items-center justify-between text-xs gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <AppIcon name="admin_panel_settings" className="text-primary text-[18px] shrink-0" />
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
                                            className={`p-2.5 rounded-2xl border transition-colors flex items-center justify-between gap-2.5 ${isCurrent
                                                    ? 'bg-primary/5 border-primary/40 shadow-xs'
                                                    : 'bg-surface-container-low/70 border-outline-variant/20 hover:border-outline-variant/50 hover:bg-surface-container-low'
                                                }`}
                                        >
                                            <button
                                                type="button"
                                                disabled={isSubmitting}
                                                onClick={async () => {
                                                    triggerHaptic('light');
                                                    if (!isDeviceClaimed && !isSwitcherUnlocked) {
                                                        const res = await claimProfile(person);
                                                        if (res.ok) {
                                                            showToast(`Device claimed as ${person}!`, 'verified_user');
                                                            handleClose();
                                                        } else {
                                                            showToast(res.message || 'Claim restricted', 'error');
                                                        }
                                                    } else {
                                                        setActivePerson(person);
                                                        showToast(`Switched active view to ${person}`);
                                                        handleClose();
                                                    }
                                                }}
                                                className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer disabled:opacity-60"
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
                                                                <AppIcon name="lock" className="text-[10px]" />
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
                                                    disabled={isSubmitting}
                                                    onClick={async () => {
                                                        triggerHaptic('success');
                                                        const res = await claimProfile(person);
                                                        if (res.ok) {
                                                            showToast(`Device rebound to ${person}!`, 'verified_user');
                                                        } else {
                                                            showToast(res.message || 'Could not rebind', 'error');
                                                        }
                                                    }}
                                                    className="px-2 py-1 rounded-lg text-[10px] font-semibold text-primary hover:bg-primary/10 border border-primary/20 shrink-0 cursor-pointer disabled:opacity-60"
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

                {/* Footer Bar: Admin Console (Admin only), Sync Status, PWA Reload & Close */}
                <div className="p-3 pb-safe border-t border-outline-variant/20 bg-surface-container-lowest shrink-0 space-y-2">
                    {isSwitcherUnlocked && onOpenAdminConsole && (
                        <div className="flex items-center justify-between text-xs px-0.5 pb-1.5 border-b border-outline-variant/15">
                            <div className="flex items-center gap-1.5 text-on-surface-variant min-w-0">
                                <AppIcon name="shield_person" className="text-primary text-[17px] shrink-0" />
                                <div className="min-w-0">
                                    <span className="font-bold text-on-surface block text-[11px] leading-tight">
                                        Admin Console &amp; Device Control
                                    </span>
                                    <span className="text-[10px] text-on-surface-variant block truncate">
                                        Audit claimed devices, block IDs &amp; lock claims
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    handleClose();
                                    onOpenAdminConsole();
                                }}
                                className="h-8 px-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors hover:bg-primary-dark"
                            >
                                <span>Open</span>
                                <AppIcon name="arrow_forward" className="text-[14px]" />
                            </button>
                        </div>
                    )}

                    {onOpenSpendHistory && (
                        <div className="flex items-center justify-between text-xs px-0.5 pb-1 border-b border-outline-variant/15">
                            <div className="flex items-center gap-1.5 text-on-surface-variant min-w-0">
                                <AppIcon name="calendar_month" className="text-primary text-[17px] shrink-0" />
                                <div className="min-w-0">
                                    <span className="font-bold text-on-surface block text-[11px] leading-tight">
                                        Month-wise Spend History
                                    </span>
                                    <span className="text-[10px] text-on-surface-variant block truncate">
                                        All transactions segregated by month
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    handleClose();
                                    onOpenSpendHistory();
                                }}
                                className="h-8 px-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
                            >
                                <span>Spends</span>
                                <AppIcon name="arrow_forward" className="text-[14px]" />
                            </button>
                        </div>
                    )}

                    {onOpenSyncStatus && (
                        <div className="flex items-center justify-between text-xs px-0.5 pb-1 border-b border-outline-variant/15">
                            <div className="flex items-center gap-1.5 text-on-surface-variant min-w-0">
                                <AppIcon name="cloud_sync" className="text-primary text-[17px] shrink-0" />
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
                                <AppIcon name="arrow_forward" className="text-[14px]" />
                            </button>
                        </div>
                    )}

                    {/* Web Push Notifications Control */}
                    <ProfilePushControl
                        claimedPerson={claimedPerson}
                        showToast={showToast}
                    />

                    <div className="flex items-center justify-between text-xs px-0.5">
                        <div className="flex items-center gap-1.5 text-on-surface-variant min-w-0">
                            <AppIcon name="cached" className="text-primary text-[17px] shrink-0" />
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
                                <AppIcon name="refresh" className="text-[15px]" />
                                <span>Reload</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => reloadApp(true)}
                                className="h-8 px-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium border border-outline-variant/20 flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
                                title="Purge static bundle cache and reload. Your user claim and offline data remain safe in localStorage."
                            >
                                <AppIcon name="restart_alt" className="text-[15px] text-secondary" />
                                <span>Hard Reload</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-3 pt-1 text-[11px] text-on-surface-variant">
                        <button
                            type="button"
                            onClick={() => {
                                handleClose();
                                onOpenPrivacy?.();
                            }}
                            className="hover:text-primary hover:underline cursor-pointer"
                        >
                            Privacy Policy
                        </button>
                        <span>•</span>
                        <button
                            type="button"
                            onClick={() => {
                                handleClose();
                                onOpenTerms?.();
                            }}
                            className="hover:text-primary hover:underline cursor-pointer"
                        >
                            Terms of Service
                        </button>
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
