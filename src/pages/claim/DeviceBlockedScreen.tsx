import React, { useId, useState } from 'react';
import { AppIcon } from '../../components';
import { useExpense } from '../../context';

export const DeviceBlockedScreen: React.FC = () => {
    const {
        currentDeviceId,
        accessRestrictionReason,
        refreshDeviceStatus,
        unlockProfileSwitch,
        setActiveTab,
        showToast,
    } = useExpense();

    const [isChecking, setIsChecking] = useState(false);
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [passcode, setPasscode] = useState('');
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const passcodeFieldId = useId();

    const handleRetry = async () => {
        setIsChecking(true);
        try {
            await refreshDeviceStatus();
        } finally {
            setIsChecking(false);
        }
    };

    const handleAdminSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUnlocking(true);
        setErrorMsg(null);
        try {
            const ok = await unlockProfileSwitch(passcode);
            if (ok) {
                setShowAdminModal(false);
                setPasscode('');
                setActiveTab('admin');
                showToast('Admin mode authenticated', 'admin_panel_settings');
            } else {
                setErrorMsg('Incorrect admin passcode.');
            }
        } finally {
            setIsUnlocking(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-surface-canvas text-on-surface flex flex-col items-center justify-center px-5 py-10 max-w-md mx-auto">
            <div className="w-full bg-surface-card border border-border-subtle rounded-3xl p-6 shadow-xs space-y-5 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-error-container text-negative flex items-center justify-center">
                    <AppIcon name="gpp_bad" className="text-[30px]" />
                </div>

                <div className="space-y-1.5">
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container label-pill uppercase">
                        Access Restricted
                    </span>
                    <h1 className="headline-lg text-on-surface pt-1">
                        Device Blocked by Admin
                    </h1>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                        {accessRestrictionReason ||
                            'This device has been blocked from accessing this SplitNest group.'}
                    </p>
                </div>

                <div className="p-3 rounded-2xl bg-surface-card-subtle border border-border-subtle text-left space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant block">
                        Device Identifier
                    </span>
                    <code className="text-xs font-mono text-on-surface break-all select-all">
                        {currentDeviceId}
                    </code>
                </div>

                <div className="space-y-2.5 pt-1">
                    <button
                        type="button"
                        onClick={handleRetry}
                        disabled={isChecking}
                        className="w-full h-11 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-dark transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        <AppIcon name="refresh" className="text-[18px]" />
                        <span>{isChecking ? 'Checking status...' : 'Check Access Again'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setErrorMsg(null);
                            setShowAdminModal(true);
                        }}
                        className="w-full h-9 rounded-xl bg-surface-card-subtle text-on-surface-variant hover:text-on-surface text-xs font-semibold transition-colors cursor-pointer"
                    >
                        Trip Admin? Unlock Console
                    </button>
                </div>
            </div>

            {showAdminModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
                    <div
                        className="fixed inset-0"
                        onClick={() => setShowAdminModal(false)}
                        aria-hidden="true"
                    />
                    <form
                        onSubmit={handleAdminSignIn}
                        className="relative z-10 w-full max-w-sm bg-surface-card border border-border-subtle rounded-3xl p-6 shadow-xl space-y-4 text-left"
                    >
                        <h2 className="headline-md text-on-surface">Admin Sign-In</h2>
                        <div>
                            <label
                                htmlFor={passcodeFieldId}
                                className="text-xs font-semibold text-on-surface-variant block mb-1.5"
                            >
                                Admin Passcode
                            </label>
                            <input
                                id={passcodeFieldId}
                                type="password"
                                value={passcode}
                                onChange={(e) => {
                                    setPasscode(e.target.value);
                                    setErrorMsg(null);
                                }}
                                placeholder="Enter passcode"
                                className="w-full h-11 px-3.5 rounded-xl bg-surface-card-subtle text-sm font-mono text-on-surface border border-border-strong focus:border-primary focus:outline-none"
                                required
                            />
                            {errorMsg && (
                                <span className="text-[11px] text-negative mt-1 block">
                                    {errorMsg}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowAdminModal(false)}
                                className="h-10 px-4 rounded-xl bg-surface-card-subtle text-xs font-semibold text-on-surface-variant cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isUnlocking}
                                className="flex-1 h-10 rounded-xl bg-primary text-on-primary text-xs font-bold cursor-pointer disabled:opacity-60"
                            >
                                {isUnlocking ? 'Verifying...' : 'Unlock'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default DeviceBlockedScreen;

