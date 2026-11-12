import React, { useId } from 'react';
import { AppIcon, Avatar } from '../../components';

interface ClaimConfirmModalProps {
    person: string;
    isLocked: boolean;
    isPendingForPerson: boolean;
    isSubmitting: boolean;
    claimError: string | null;
    requiresApproval: boolean;
    onConfirmClaim: (person: string) => void;
    onRequestApproval: (person: string) => void;
    onClose: () => void;
}

export const ClaimConfirmModal: React.FC<ClaimConfirmModalProps> = ({
    person,
    isLocked,
    isPendingForPerson,
    isSubmitting,
    claimError,
    requiresApproval,
    onConfirmClaim,
    onRequestApproval,
    onClose,
}) => {
    const showApprovalFlow = requiresApproval || isLocked;

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
            <div className="relative z-10 w-full max-w-sm bg-surface-card border border-border-subtle rounded-3xl p-6 shadow-2xl space-y-4 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center relative">
                    <Avatar name={person} size="lg" />
                    <span
                        className={`absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full ring-2 ring-surface-card flex items-center justify-center shadow-xs ${
                            showApprovalFlow
                                ? 'bg-status-pending-bg text-status-pending-text'
                                : 'bg-primary text-on-primary'
                        }`}
                    >
                        <AppIcon
                            name={showApprovalFlow ? 'verified_user' : 'lock'}
                            className="text-[12px] leading-none"
                        />
                    </span>
                </div>

                <div className="space-y-1">
                    <h3 className="text-lg font-bold text-on-surface font-headline">
                        {showApprovalFlow
                            ? `${person}'s ID is Protected`
                            : `Claim device as ${person}?`}
                    </h3>
                    <p className="text-xs text-on-surface-variant leading-relaxed px-2">
                        {showApprovalFlow
                            ? `New device claims for ${person} are locked by the trip admin to prevent impersonation.`
                            : `This phone will be registered to ${person}. You will be able to confirm settlements owed to you and record shared expenses.`}
                    </p>
                </div>

                {claimError && (
                    <div className="p-2.5 rounded-xl bg-error-container text-on-error-container text-[11px] font-medium">
                        {claimError}
                    </div>
                )}

                {isPendingForPerson && (
                    <div className="p-2.5 rounded-xl bg-status-awaiting-bg text-status-awaiting-text text-[11px] font-semibold flex items-center justify-center gap-1.5">
                        <AppIcon name="hourglass_top" className="text-[15px]" />
                        <span>Approval request is pending admin review</span>
                    </div>
                )}

                <div className="flex flex-col gap-2 pt-1">
                    {!showApprovalFlow && (
                        <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => onConfirmClaim(person)}
                            className="w-full h-11 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-xs hover:bg-primary-dark transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
                        >
                            <AppIcon name="check_circle" className="text-[18px]" />
                            <span>{isSubmitting ? 'Verifying...' : `Yes, I am ${person}`}</span>
                        </button>
                    )}

                    {showApprovalFlow && (
                        <>
                            <button
                                type="button"
                                disabled={isSubmitting || isPendingForPerson}
                                onClick={() => onRequestApproval(person)}
                                className="w-full h-11 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-xs hover:bg-primary-dark transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
                            >
                                <AppIcon name="approval_delegation" className="text-[17px]" />
                                <span>
                                    {isSubmitting
                                        ? 'Submitting request...'
                                        : isPendingForPerson
                                          ? 'Approval Requested'
                                          : `Request Admin Approval for ${person}`}
                                </span>
                            </button>
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => onConfirmClaim(person)}
                                className="w-full h-10 rounded-xl bg-surface-card-subtle text-primary font-semibold text-xs hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-60"
                            >
                                Try Claim (If Pre-Approved)
                            </button>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full h-9 rounded-xl bg-surface-card-subtle text-on-surface-variant hover:text-on-surface font-semibold text-xs transition-colors cursor-pointer"
                    >
                        Choose someone else
                    </button>
                </div>
            </div>
        </div>
    );
};

interface ClaimAdminModalProps {
    passcodeInput: string;
    passcodeError: boolean;
    isUnlocking: boolean;
    onChangePasscode: (val: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
}

export const ClaimAdminModal: React.FC<ClaimAdminModalProps> = ({
    passcodeInput,
    passcodeError,
    isUnlocking,
    onChangePasscode,
    onSubmit,
    onClose,
}) => {
    const inputId = useId();

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
            <form
                onSubmit={onSubmit}
                className="relative z-10 w-full max-w-sm bg-surface-card border border-border-subtle rounded-3xl p-6 shadow-2xl space-y-4 text-left"
            >
                <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                    <div className="flex items-center gap-2">
                        <AppIcon name="admin_panel_settings" className="text-primary text-[22px]" />
                        <h3 className="font-bold text-base text-on-surface font-headline">
                            Admin Unlock
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-7 h-7 rounded-full bg-surface-card-subtle flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                        aria-label="Close modal"
                    >
                        <AppIcon name="close" className="text-[16px]" />
                    </button>
                </div>

                <p className="text-xs text-on-surface-variant leading-relaxed">
                    Enter the server-verified admin passcode to unlock profiles and access the Admin Device Console.
                </p>

                <div>
                    <label
                        htmlFor={inputId}
                        className="text-xs font-semibold text-on-surface-variant block mb-1.5"
                    >
                        Admin Passcode
                    </label>
                    <input
                        id={inputId}
                        type="password"
                        value={passcodeInput}
                        onChange={(e) => onChangePasscode(e.target.value)}
                        placeholder="Enter passcode"
                        className={`w-full h-11 px-3.5 rounded-xl bg-surface-card-subtle text-sm font-mono text-on-surface border focus:outline-none transition-colors ${
                            passcodeError
                                ? 'border-negative focus:border-negative'
                                : 'border-border-strong focus:border-primary'
                        }`}
                        required
                    />
                    {passcodeError && (
                        <span className="text-[11px] text-negative mt-1 block">
                            Incorrect admin passcode or server rejected login.
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-10 px-4 rounded-xl bg-surface-card-subtle text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isUnlocking}
                        className="flex-1 h-10 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-dark transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
                    >
                        {isUnlocking ? 'Verifying...' : 'Unlock App'}
                    </button>
                </div>
            </form>
        </div>
    );
};

