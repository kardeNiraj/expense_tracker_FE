import React, { useState } from 'react';
import { useExpense } from '../../context';
import { usePeople, usePeopleDetails, useTripInfo } from '../../api';
import { Avatar } from '../../components/Avatar';
import { AppIcon, ClaimMembersSkeleton } from '../../components';
import { ENV } from '../../config';
import { ClaimAdminModal, ClaimConfirmModal } from './ClaimModals';

export const ClaimIdentityScreen: React.FC = () => {
    const {
        claimProfile,
        requestClaimApproval,
        unlockProfileSwitch,
        refreshDeviceStatus,
        personLocks,
        blockedPeopleForDevice,
        deviceState,
        showToast,
    } = useExpense();
    const { data: people = [], isLoading, isError, refetch } = usePeople();
    usePeopleDetails();
    const { data: tripInfo } = useTripInfo();

    const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
    const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
    const [claimError, setClaimError] = useState<string | null>(null);
    const [requiresApproval, setRequiresApproval] = useState(false);

    const [showAdminModal, setShowAdminModal] = useState(false);
    const [passcodeInput, setPasscodeInput] = useState('');
    const [passcodeError, setPasscodeError] = useState(false);
    const [isUnlockingAdmin, setIsUnlockingAdmin] = useState(false);

    const tripTitle = tripInfo?.title || ENV.DEFAULT_TRIP_TITLE;
    const tripSubtitle = tripInfo?.subtitle || ENV.DEFAULT_TRIP_SUBTITLE;
    const tripIcon = tripInfo?.icon || ENV.DEFAULT_TRIP_ICON;

    const pendingPerson = deviceState?.pendingPerson || null;
    const blockedSet = new Set(blockedPeopleForDevice.map((p) => p.toLowerCase()));

    const openPersonModal = (person: string) => {
        if (blockedSet.has(person.toLowerCase())) {
            showToast(`This device is blocked from using ${person}'s profile.`, 'gpp_bad');
            return;
        }
        setClaimError(null);
        setRequiresApproval(false);
        setSelectedPerson(person);
    };

    const handleConfirmClaim = async (person: string) => {
        setIsSubmittingClaim(true);
        setClaimError(null);
        try {
            const res = await claimProfile(person);
            if (res.ok) {
                showToast(`Device claimed as ${person}! Welcome aboard.`, 'verified_user');
                setSelectedPerson(null);
            } else {
                setClaimError(res.message || 'Could not claim this profile.');
                if (res.code === 'CLAIM_LOCKED') {
                    setRequiresApproval(true);
                }
            }
        } finally {
            setIsSubmittingClaim(false);
        }
    };

    const handleRequestApproval = async (person: string) => {
        setIsSubmittingClaim(true);
        setClaimError(null);
        try {
            const res = await requestClaimApproval(person);
            if (res.ok) {
                showToast(
                    `Approval request sent for ${person}. Ask admin to approve.`,
                    'hourglass_top'
                );
                setSelectedPerson(null);
            } else {
                setClaimError(res.message || 'Could not send approval request.');
            }
        } finally {
            setIsSubmittingClaim(false);
        }
    };

    const handleAdminUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUnlockingAdmin(true);
        try {
            const success = await unlockProfileSwitch(passcodeInput);
            if (success) {
                setPasscodeError(false);
                setPasscodeInput('');
                setShowAdminModal(false);
                showToast('Admin Mode unlocked! You can view all profiles.', 'admin_panel_settings');
            } else {
                setPasscodeError(true);
                showToast('Incorrect admin passcode', 'error');
            }
        } finally {
            setIsUnlockingAdmin(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-surface-canvas text-on-surface flex flex-col justify-between px-4 py-8 max-w-md mx-auto relative font-sans overflow-x-hidden">
            {/* Top Section: Branding & Header */}
            <div className="relative z-10 space-y-4 pt-2">
                <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-xs">
                        <AppIcon name={tripIcon} className="text-[24px]" />
                    </div>
                    <div>
                        <span className="label-pill text-primary uppercase block">
                            {tripSubtitle}
                        </span>
                        <h2 className="text-lg font-bold text-on-surface font-headline leading-tight">
                            {tripTitle}
                        </h2>
                    </div>
                </div>

                <div className="space-y-1.5 pt-1">
                    <h1 className="headline-lg text-on-surface tracking-tight">
                        Who is using this phone?
                    </h1>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                        Select your name below to verify and bind this device. Protected identities require admin approval on new phones.
                    </p>
                </div>

                {pendingPerson && (
                    <div className="p-3.5 rounded-2xl bg-status-awaiting-bg border border-border-subtle flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <span className="text-xs font-bold text-status-awaiting-text block">
                                Approval Pending: {pendingPerson}
                            </span>
                            <span className="text-[11px] text-on-surface-variant block">
                                Waiting for admin approval to activate this device.
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => void refreshDeviceStatus()}
                            className="px-2.5 py-1.5 rounded-xl bg-surface-card text-primary text-[11px] font-bold border border-border-subtle shrink-0 cursor-pointer"
                        >
                            Refresh
                        </button>
                    </div>
                )}
            </div>

            {/* Middle Section: Members List */}
            <div className="relative z-10 flex-1 my-5 space-y-2">
                <div className="flex items-center justify-between px-1">
                    <span className="label-pill text-on-surface uppercase">
                        Trip Members ({people.length})
                    </span>
                    <span className="text-[11px] text-primary font-medium">Tap your name</span>
                </div>

                {isLoading && <ClaimMembersSkeleton />}

                {isError && (
                    <div className="p-4 rounded-2xl bg-error-container text-on-error-container text-xs text-center space-y-2">
                        <p>Could not load trip members from server.</p>
                        <button
                            type="button"
                            onClick={() => refetch()}
                            className="px-3 py-1.5 rounded-lg bg-on-error-container text-error-container font-bold text-xs cursor-pointer"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {!isLoading && !isError && people.length === 0 && (
                    <div className="p-4 rounded-2xl bg-surface-card-subtle border border-border-subtle text-xs text-on-surface-variant text-center">
                        No trip members found in the sheet yet. Ask your trip admin to add members.
                    </div>
                )}

                <div className="space-y-2 max-h-[50vh] overflow-y-auto no-scrollbar pr-0.5">
                    {people.map((person) => {
                        const isBlocked = blockedSet.has(person.toLowerCase());
                        const isLocked = Boolean(personLocks[person]);
                        const isPending =
                            pendingPerson?.toLowerCase() === person.toLowerCase();

                        return (
                            <button
                                key={person}
                                type="button"
                                disabled={isBlocked}
                                onClick={() => openPersonModal(person)}
                                className={`w-full p-3.5 rounded-2xl border shadow-xs flex items-center justify-between gap-3 text-left transition-colors ${
                                    isBlocked
                                        ? 'bg-surface-card-subtle border-border-subtle opacity-60 cursor-not-allowed'
                                        : 'bg-surface-card border-border-subtle hover:border-primary/50 hover:bg-surface-card-subtle/60 cursor-pointer'
                                }`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <Avatar name={person} size="md" />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <h3 className="font-bold text-sm text-on-surface truncate">
                                                {person}
                                            </h3>
                                            {isBlocked && (
                                                <span className="px-1.5 py-0.5 rounded-full bg-error-container text-negative text-[10px] font-bold">
                                                    Blocked
                                                </span>
                                            )}
                                            {!isBlocked && isLocked && (
                                                <span className="px-1.5 py-0.5 rounded-full bg-status-pending-bg text-status-pending-text text-[10px] font-bold flex items-center gap-0.5">
                                                    <AppIcon name="lock" className="text-[11px]" />
                                                    <span>Protected</span>
                                                </span>
                                            )}
                                            {isPending && (
                                                <span className="px-1.5 py-0.5 rounded-full bg-status-awaiting-bg text-status-awaiting-text text-[10px] font-bold">
                                                    Requested
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[11px] text-on-surface-variant block">
                                            {isBlocked
                                                ? 'Restricted on this device by admin'
                                                : isLocked
                                                  ? 'Requires admin approval on new devices'
                                                  : 'Tap to claim phone'}
                                        </span>
                                    </div>
                                </div>

                                <span
                                    className={`h-8 px-3 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 ${
                                        isBlocked
                                            ? 'bg-surface-card-subtle text-on-surface-variant'
                                            : isLocked
                                              ? 'bg-status-pending-bg text-status-pending-text'
                                              : 'bg-primary/10 text-primary'
                                    }`}
                                >
                                    <span>{isBlocked ? 'Blocked' : isLocked ? 'Verify' : `I'm ${person}`}</span>
                                    {!isBlocked && (
                                        <AppIcon name={isLocked ? 'approval_delegation' : 'arrow_forward'} className="text-[14px]" />
                                    )}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Section: Admin Bypass Option */}
            <div className="relative z-10 pt-2 border-t border-border-subtle flex flex-col items-center gap-2">
                <button
                    type="button"
                    onClick={() => {
                        setPasscodeError(false);
                        setPasscodeInput('');
                        setShowAdminModal(true);
                    }}
                    className="text-xs text-on-surface-variant hover:text-primary transition-colors font-medium flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-surface-card-subtle cursor-pointer"
                >
                    <AppIcon name="admin_panel_settings" className="text-[16px]" />
                    <span>Trip Organizer / Admin? Unlock all profiles</span>
                </button>
                <span className="text-[10px] text-outline font-mono text-center">
                    Device identities are audited & protected by server admin controls.
                </span>
            </div>

            {selectedPerson && (
                <ClaimConfirmModal
                    person={selectedPerson}
                    isLocked={Boolean(personLocks[selectedPerson])}
                    isPendingForPerson={
                        pendingPerson?.toLowerCase() === selectedPerson.toLowerCase()
                    }
                    isSubmitting={isSubmittingClaim}
                    claimError={claimError}
                    requiresApproval={requiresApproval}
                    onConfirmClaim={handleConfirmClaim}
                    onRequestApproval={handleRequestApproval}
                    onClose={() => setSelectedPerson(null)}
                />
            )}

            {showAdminModal && (
                <ClaimAdminModal
                    passcodeInput={passcodeInput}
                    passcodeError={passcodeError}
                    isUnlocking={isUnlockingAdmin}
                    onChangePasscode={(val) => {
                        setPasscodeInput(val);
                        setPasscodeError(false);
                    }}
                    onSubmit={handleAdminUnlock}
                    onClose={() => setShowAdminModal(false)}
                />
            )}
        </div>
    );
};

export default ClaimIdentityScreen;
