import React, { useId, useState } from 'react';
import { useExpense } from '../../../context';

export const AdminAccessGate: React.FC = () => {
    const { unlockProfileSwitch, setActiveTab, showToast } = useExpense();
    const [passcode, setPasscode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);
    const inputId = useId();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrorText(null);
        try {
            const ok = await unlockProfileSwitch(passcode);
            if (ok) {
                setPasscode('');
                showToast('Admin Console unlocked', 'admin_panel_settings');
            } else {
                setErrorText('Invalid admin passcode. Access denied.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-[80vh] w-full flex flex-col items-center justify-center py-8 px-1">
            <div className="w-full bg-surface-card border border-border-subtle rounded-3xl p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[26px]">
                            admin_panel_settings
                        </span>
                    </div>
                    <div>
                        <span className="label-pill text-primary uppercase block">
                            Strict Access Control
                        </span>
                        <h1 className="headline-md text-on-surface">
                            Admin Console
                        </h1>
                    </div>
                </div>

                <p className="text-xs text-on-surface-variant leading-relaxed">
                    This route is restricted to the trip administrator. Enter your server-verified admin passcode to audit claimed devices, block unauthorized IDs, or lock member profiles.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
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
                            value={passcode}
                            onChange={(e) => {
                                setPasscode(e.target.value);
                                setErrorText(null);
                            }}
                            placeholder="Enter admin passcode"
                            className={`w-full h-11 px-3.5 rounded-xl bg-surface-card-subtle text-sm font-mono text-on-surface border focus:outline-none transition-colors ${
                                errorText
                                    ? 'border-negative focus:border-negative'
                                    : 'border-border-strong focus:border-primary'
                            }`}
                            required
                        />
                        {errorText && (
                            <span className="text-[11px] text-negative mt-1 block font-medium">
                                {errorText}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab('dashboard')}
                            className="h-11 px-4 rounded-xl bg-surface-card-subtle text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors"
                        >
                            Back to App
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 h-11 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-dark cursor-pointer transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                        >
                            <span className="material-symbols-outlined text-[16px]">
                                lock_open
                            </span>
                            <span>{isSubmitting ? 'Verifying...' : 'Authenticate Admin'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminAccessGate;

