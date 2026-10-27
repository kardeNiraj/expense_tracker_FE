import React, { useState } from 'react';
import { Avatar } from '../Avatar';
import { useExpense } from '../../context';
import type { SettlementAppLinks } from '../../api/types';

export interface PaymentSettlementData {
    to: string;
    amount: number;
    toUpiId?: string | null;
    upiIntent?: string;
    appLinks?: SettlementAppLinks;
    description?: string;
}

export interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    settlement: PaymentSettlementData | null;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
    isOpen,
    onClose,
    settlement,
}) => {
    const { showToast } = useExpense();
    const [copiedUpi, setCopiedUpi] = useState(false);
    const [copiedAmount, setCopiedAmount] = useState(false);

    if (!isOpen || !settlement) return null;

    const toUpiId = settlement.toUpiId?.trim() || '';
    const encodedUpiId = encodeURIComponent(toUpiId);
    const encodedName = encodeURIComponent(settlement.to);
    const encodedNote = encodeURIComponent(`Split-${settlement.description || 'Payment'}`.slice(0, 30));

    // Direct app links if not pre-populated
    const phonepeLink =
        settlement.appLinks?.phonepe ||
        (toUpiId
            ? `phonepe://pay?pa=${encodedUpiId}&pn=${encodedName}&am=${settlement.amount}&cu=INR&tn=${encodedNote}`
            : undefined);

    const gpayLink =
        settlement.appLinks?.gpay ||
        (toUpiId
            ? `gpay://upi/pay?pa=${encodedUpiId}&pn=${encodedName}&am=${settlement.amount}&cu=INR&tn=${encodedNote}`
            : undefined);

    const paytmLink =
        settlement.appLinks?.paytm ||
        (toUpiId
            ? `paytmmp://pay?pa=${encodedUpiId}&pn=${encodedName}&am=${settlement.amount}&cu=INR&tn=${encodedNote}`
            : undefined);

    const standardLink =
        settlement.appLinks?.standard ||
        settlement.upiIntent ||
        (toUpiId
            ? `upi://pay?pa=${encodedUpiId}&pn=${encodedName}&am=${settlement.amount}&cu=INR&tn=${encodedNote}`
            : undefined);

    const handleCopyUpi = async () => {
        if (!toUpiId) return;
        try {
            await navigator.clipboard.writeText(toUpiId);
            setCopiedUpi(true);
            showToast(`Copied UPI ID: ${toUpiId}`, 'content_copy');
            setTimeout(() => setCopiedUpi(false), 2500);
        } catch {
            showToast('Failed to copy UPI ID', 'error');
        }
    };

    const handleCopyAmount = async () => {
        try {
            await navigator.clipboard.writeText(settlement.amount.toString());
            setCopiedAmount(true);
            showToast(`Copied amount: ₹${settlement.amount}`, 'payments');
            setTimeout(() => setCopiedAmount(false), 2500);
        } catch {
            showToast('Failed to copy amount', 'error');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            {/* Backdrop click dismiss */}
            <div
                className="fixed inset-0"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal Card */}
            <div className="relative z-10 w-full max-w-sm max-h-[92vh] overflow-y-auto bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-5 shadow-2xl space-y-4 text-on-surface">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={settlement.to} size="md" />
                        <div className="min-w-0">
                            <h3 className="font-bold text-sm text-on-surface truncate">
                                Pay {settlement.to}
                            </h3>
                            <p className="text-[11px] text-on-surface-variant truncate">
                                {settlement.description ? `For "${settlement.description}"` : 'Settlement Share'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                        aria-label="Close"
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            close
                        </span>
                    </button>
                </div>

                {/* Amount Hero Box */}
                <div className="bg-surface-container/60 border border-outline-variant/25 rounded-2xl p-4 text-center space-y-1">
                    <span className="text-[10px] tracking-wider uppercase font-semibold text-on-surface-variant">
                        Amount to Pay
                    </span>
                    <div className="text-3xl font-extrabold font-mono text-primary flex items-center justify-center gap-1.5">
                        <span>₹{settlement.amount.toLocaleString('en-IN')}</span>
                        <button
                            type="button"
                            onClick={handleCopyAmount}
                            className="p-1 rounded-md text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                            title="Copy amount"
                        >
                            <span className="material-symbols-outlined text-[16px]">
                                {copiedAmount ? 'check' : 'content_copy'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* 1-Tap Copy UPI ID Card (Bulletproof P2P payment) */}
                {toUpiId ? (
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                                <span className="material-symbols-outlined text-[15px]">
                                    verified
                                </span>
                                1-Tap Copy UPI ID (Recommended)
                            </span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                100% Reliable
                            </span>
                        </div>

                        <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-3 py-2">
                            <span className="font-mono text-xs text-on-surface font-semibold truncate flex-1 select-all">
                                {toUpiId}
                            </span>
                            <button
                                type="button"
                                onClick={handleCopyUpi}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                    copiedUpi
                                        ? 'bg-primary text-on-primary shadow-xs'
                                        : 'bg-primary/10 text-primary hover:bg-primary hover:text-on-primary'
                                }`}
                            >
                                <span className="material-symbols-outlined text-[14px]">
                                    {copiedUpi ? 'check' : 'content_copy'}
                                </span>
                                <span>{copiedUpi ? 'Copied!' : 'Copy'}</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-tertiary-container/30 border border-tertiary/30 rounded-2xl p-3 text-xs text-on-tertiary-container flex items-start gap-2">
                        <span className="material-symbols-outlined text-[18px] text-tertiary shrink-0 mt-0.5">
                            warning
                        </span>
                        <div>
                            <span className="font-semibold block">No UPI ID registered</span>
                            <span>{settlement.to} has not added their UPI ID yet. Ask them to add it under the Members tab.</span>
                        </div>
                    </div>
                )}

                {/* Direct App Launch Links */}
                {toUpiId && (
                    <div className="space-y-2 pt-1">
                        <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider block">
                            Or Launch UPI App Directly
                        </span>

                        <div className="grid grid-cols-1 gap-2">
                            {/* PhonePe */}
                            {phonepeLink && (
                                <a
                                    href={phonepeLink}
                                    onClick={() => showToast('Launching PhonePe...', 'rocket_launch')}
                                    className="h-11 px-3.5 rounded-xl bg-[#5f259f] hover:bg-[#521f8a] text-white font-semibold text-xs flex items-center justify-between transition-transform active:scale-[0.98] shadow-xs"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px]">
                                            payments
                                        </span>
                                        <span>PhonePe</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[16px] opacity-80">
                                        arrow_forward
                                    </span>
                                </a>
                            )}

                            {/* Google Pay */}
                            {gpayLink && (
                                <a
                                    href={gpayLink}
                                    onClick={() => showToast('Launching Google Pay...', 'rocket_launch')}
                                    className="h-11 px-3.5 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-white font-semibold text-xs flex items-center justify-between transition-transform active:scale-[0.98] shadow-xs"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px]">
                                            account_balance_wallet
                                        </span>
                                        <span>Google Pay</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[16px] opacity-80">
                                        arrow_forward
                                    </span>
                                </a>
                            )}

                            {/* Paytm */}
                            {paytmLink && (
                                <a
                                    href={paytmLink}
                                    onClick={() => showToast('Launching Paytm...', 'rocket_launch')}
                                    className="h-11 px-3.5 rounded-xl bg-[#002e6e] hover:bg-[#002252] text-white font-semibold text-xs flex items-center justify-between transition-transform active:scale-[0.98] shadow-xs"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px]">
                                            account_balance
                                        </span>
                                        <span>Paytm</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[16px] opacity-80">
                                        arrow_forward
                                    </span>
                                </a>
                            )}

                            {/* Other / Standard UPI */}
                            {standardLink && (
                                <a
                                    href={standardLink}
                                    onClick={() => showToast('Launching UPI intent...', 'rocket_launch')}
                                    className="h-10 px-3.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center justify-between border border-outline-variant/30 transition-transform active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px] text-primary">
                                            bolt
                                        </span>
                                        <span>Any UPI App (Default)</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                                        open_in_new
                                    </span>
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {/* NPCI / Bank Risk Policy Advice Note */}
                <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-3 text-[11px] text-on-surface-variant flex items-start gap-2 leading-relaxed">
                    <span className="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">
                        lightbulb
                    </span>
                    <div>
                        <span className="font-semibold text-on-surface block mb-0.5">
                            Bank Link Protection
                        </span>
                        <span>
                            If an app shows a &apos;Risk policy decline&apos; or fails to open, tap{' '}
                            <strong className="text-primary font-semibold">Copy</strong> above, open PhonePe or Google Pay, and paste into the search bar.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
