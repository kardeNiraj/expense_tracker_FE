import React, { useState } from 'react';
import { useExpense } from '../../context';
import { usePeople, useTripInfo } from '../../api';
import { Avatar } from '../../components/Avatar';
import { ENV } from '../../config';

export const ClaimIdentityScreen: React.FC = () => {
    const { claimProfile, unlockProfileSwitch, showToast } = useExpense();
    const { data: people = [], isLoading, isError, refetch } = usePeople();
    const { data: tripInfo } = useTripInfo();

    const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [passcodeInput, setPasscodeInput] = useState('');
    const [passcodeError, setPasscodeError] = useState(false);

    const tripTitle = tripInfo?.title || ENV.DEFAULT_TRIP_TITLE;
    const tripSubtitle = tripInfo?.subtitle || ENV.DEFAULT_TRIP_SUBTITLE;
    const tripIcon = tripInfo?.icon || ENV.DEFAULT_TRIP_ICON;

    const handleConfirmClaim = (person: string) => {
        claimProfile(person);
        showToast(`Device claimed as ${person}! Welcome aboard.`, 'verified_user');
        setSelectedPerson(null);
    };

    const handleAdminUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        const success = unlockProfileSwitch(passcodeInput);
        if (success) {
            setPasscodeError(false);
            setPasscodeInput('');
            setShowAdminModal(false);
            showToast('Admin Mode unlocked! You can view any profile.', 'admin_panel_settings');
        } else {
            setPasscodeError(true);
            showToast('Incorrect admin passcode', 'error');
        }
    };

    return (
        <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col justify-between px-4 py-8 max-w-md mx-auto relative font-sans overflow-x-hidden">
            {/* Background decorative glow */}
            <div
                className="absolute -top-24 -left-24 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none"
                aria-hidden="true"
            />
            <div
                className="absolute -bottom-24 -right-24 w-72 h-72 bg-secondary/10 rounded-full blur-3xl pointer-events-none"
                aria-hidden="true"
            />

            {/* Top Section: Branding & Welcoming Header */}
            <div className="relative z-10 space-y-4 pt-2">
                <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-md">
                        <span className="material-symbols-outlined text-[24px]">
                            {tripIcon}
                        </span>
                    </div>
                    <div>
                        <span className="text-[11px] font-bold text-primary uppercase tracking-wider font-mono block">
                            {tripSubtitle}
                        </span>
                        <h2 className="text-lg font-bold text-on-surface font-headline leading-tight">
                            {tripTitle}
                        </h2>
                    </div>
                </div>

                <div className="space-y-1.5 pt-2">
                    <h1 className="text-2xl font-extrabold text-on-surface font-headline tracking-tight">
                        Who is using this phone?
                    </h1>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                        Select your name below to claim this device. Your owes, balances, and settlement receipts will be locked to your identity.
                    </p>
                </div>

                {/* Security Feature Notice */}
                <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-start gap-2.5 shadow-2xs">
                    <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">
                        verified_user
                    </span>
                    <div className="text-[11px] text-on-surface-variant leading-normal">
                        <strong className="text-on-surface">Private & Secure:</strong> Only the person receiving money can confirm debt settlements, preventing accidental or unauthorized approvals.
                    </div>
                </div>
            </div>

            {/* Middle Section: Members Grid / List */}
            <div className="relative z-10 flex-1 my-6 space-y-2">
                <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-on-surface uppercase tracking-wider font-mono">
                        Trip Members ({people.length})
                    </span>
                    <span className="text-[11px] text-primary font-medium">
                        Tap your name
                    </span>
                </div>

                {isLoading && (
                    <div className="space-y-2.5 pt-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div
                                key={i}
                                className="h-16 rounded-2xl bg-surface-container-low animate-pulse flex items-center px-4 gap-3 border border-outline-variant/20"
                            >
                                <div className="w-10 h-10 rounded-full bg-surface-container-high" />
                                <div className="flex-1 space-y-1.5">
                                    <div className="w-24 h-3.5 bg-surface-container-high rounded" />
                                    <div className="w-36 h-2.5 bg-surface-container-high rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {isError && (
                    <div className="p-4 rounded-2xl bg-error-container text-on-error-container text-xs text-center space-y-2">
                        <p>Could not load trip members from Google Sheets.</p>
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
                    <div className="p-6 rounded-2xl bg-surface-container-low text-center text-xs text-on-surface-variant">
                        No members found. Please check Google Sheets configuration.
                    </div>
                )}

                <div className="space-y-2 max-h-[50vh] overflow-y-auto no-scrollbar pr-0.5">
                    {people.map((person) => (
                        <button
                            key={person}
                            type="button"
                            onClick={() => setSelectedPerson(person)}
                            className="w-full p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 hover:border-primary/50 hover:bg-surface-container-low/70 transition-all shadow-xs flex items-center justify-between gap-3 text-left group cursor-pointer active:scale-[0.99]"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <Avatar name={person} size="md" />
                                <div className="min-w-0">
                                    <h3 className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors truncate">
                                        {person}
                                    </h3>
                                    <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                                        <span>Tap to claim phone</span>
                                    </span>
                                </div>
                            </div>

                            <span className="h-8 px-3 rounded-xl bg-surface-container text-primary text-xs font-bold group-hover:bg-primary group-hover:text-on-primary transition-colors flex items-center gap-1 shrink-0">
                                <span>I'm {person}</span>
                                <span className="material-symbols-outlined text-[14px]">
                                    arrow_forward
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Bottom Section: Admin Bypass Option */}
            <div className="relative z-10 pt-2 border-t border-outline-variant/20 flex flex-col items-center gap-2">
                <button
                    type="button"
                    onClick={() => {
                        setPasscodeError(false);
                        setPasscodeInput('');
                        setShowAdminModal(true);
                    }}
                    className="text-xs text-on-surface-variant hover:text-primary transition-colors font-medium flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-surface-container cursor-pointer"
                >
                    <span className="material-symbols-outlined text-[16px]">
                        admin_panel_settings
                    </span>
                    <span>Trip Organizer / Admin? Unlock all profiles</span>
                </button>
                <span className="text-[10px] text-outline font-mono">
                    Device binding can be re-locked or changed anytime with admin passcode.
                </span>
            </div>

            {/* Confirmation Modal when tapping a member */}
            {selectedPerson && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
                    <div
                        className="fixed inset-0"
                        onClick={() => setSelectedPerson(null)}
                        aria-hidden="true"
                    />
                    <div className="relative z-10 w-full max-w-sm bg-surface-container-lowest border border-outline-variant/40 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
                        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center relative">
                            <Avatar name={selectedPerson} size="lg" />
                            <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-primary text-on-primary ring-2 ring-surface-container-lowest flex items-center justify-center shadow-xs">
                                <span className="material-symbols-outlined text-[11px] leading-none">lock</span>
                            </span>
                        </div>

                        <div className="space-y-1">
                            <h3 className="text-lg font-bold text-on-surface font-headline">
                                Claim device as {selectedPerson}?
                            </h3>
                            <p className="text-xs text-on-surface-variant leading-relaxed px-2">
                                This phone will be registered to <strong className="text-on-surface">{selectedPerson}</strong>. You will be able to confirm settlements owed to you and record shared expenses.
                            </p>
                        </div>

                        <div className="p-3 rounded-xl bg-surface-container-low text-[11px] text-on-surface-variant">
                            Switching profiles on this phone afterwards requires the trip admin passcode.
                        </div>

                        <div className="flex flex-col gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => handleConfirmClaim(selectedPerson)}
                                className="w-full h-11 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-md hover:bg-primary/90 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-[18px]">
                                    check_circle
                                </span>
                                <span>Yes, I am {selectedPerson}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedPerson(null)}
                                className="w-full h-9 rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface font-semibold text-xs transition-colors cursor-pointer"
                            >
                                Choose someone else
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin Passcode Modal */}
            {showAdminModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
                    <div
                        className="fixed inset-0"
                        onClick={() => setShowAdminModal(false)}
                        aria-hidden="true"
                    />
                    <form
                        onSubmit={handleAdminUnlock}
                        className="relative z-10 w-full max-w-sm bg-surface-container-lowest border border-outline-variant/40 rounded-3xl p-6 shadow-2xl space-y-4 text-left"
                    >
                        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-[22px]">
                                    admin_panel_settings
                                </span>
                                <h3 className="font-bold text-base text-on-surface font-headline">
                                    Admin Unlock
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAdminModal(false)}
                                className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                        </div>

                        <p className="text-xs text-on-surface-variant leading-relaxed">
                            Enter the trip admin passcode to open the app without locking it to a single person. You will be able to switch profiles freely.
                        </p>

                        <div>
                            <label
                                htmlFor="claim-admin-passcode"
                                className="text-xs font-semibold text-on-surface-variant block mb-1.5"
                            >
                                Admin Passcode
                            </label>
                            <input
                                id="claim-admin-passcode"
                                type="password"
                                value={passcodeInput}
                                onChange={(e) => {
                                    setPasscodeInput(e.target.value);
                                    setPasscodeError(false);
                                }}
                                placeholder="Enter passcode (default: 1234)"
                                className={`w-full h-11 px-3.5 rounded-xl bg-surface-container-low text-sm font-mono text-on-surface border focus:outline-none transition-colors ${
                                    passcodeError
                                        ? 'border-error focus:border-error'
                                        : 'border-outline-variant/30 focus:border-primary'
                                }`}
                                autoFocus
                                required
                            />
                            {passcodeError && (
                                <span className="text-[11px] text-error mt-1 block">
                                    Incorrect admin passcode.
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowAdminModal(false)}
                                className="h-10 px-4 rounded-xl bg-surface-container text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 h-10 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer shadow-xs"
                            >
                                Unlock App
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default ClaimIdentityScreen;
