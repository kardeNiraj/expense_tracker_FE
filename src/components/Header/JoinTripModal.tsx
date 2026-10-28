import React, { useState } from 'react';
import { QRCode } from '../QRCode';
import { triggerHaptic } from '../../utils/haptics';
import { useExpense } from '../../context';

interface JoinTripModalProps {
    isOpen: boolean;
    onClose: () => void;
    tripTitle: string;
    tripSubtitle: string;
    tripIcon: string;
}

export const JoinTripModal: React.FC<JoinTripModalProps> = ({
    isOpen,
    onClose,
    tripTitle,
    tripSubtitle,
    tripIcon,
}) => {
    const { showToast } = useExpense();
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const joinUrl = typeof window !== 'undefined' ? window.location.origin : '';

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(joinUrl);
            triggerHaptic('success');
            setCopied(true);
            showToast('Invite link copied to clipboard!', 'content_copy');
            setTimeout(() => setCopied(false), 2500);
        } catch {
            triggerHaptic('warning');
            showToast('Failed to copy link', 'error');
        }
    };

    const handleWhatsAppShare = () => {
        triggerHaptic('light');
        const text = `Hey! Join our trip expense tracker for "${tripTitle}":\n👉 ${joinUrl}\nClaim your name to track and split bills seamlessly!`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            {/* Backdrop click dismiss */}
            <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

            {/* Bottom Sheet Card */}
            <div className="relative z-10 w-full max-w-sm max-h-[92vh] overflow-y-auto bg-surface-container-lowest border-t sm:border border-outline-variant/30 rounded-t-3xl sm:rounded-3xl p-5 pb-safe shadow-2xl space-y-4 text-on-surface animate-in slide-in-from-bottom duration-250">
                {/* Mobile Handle Pill */}
                <div className="w-12 h-1 bg-outline-variant/40 rounded-full mx-auto -mt-1 mb-2 sm:hidden" />

                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-xs shrink-0">
                            <span className="material-symbols-outlined text-[22px]">
                                {tripIcon}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-base text-on-surface truncate font-headline">
                                Invite to {tripTitle}
                            </h3>
                            <p className="text-[11px] text-on-surface-variant truncate">
                                {tripSubtitle || 'Share with your travel crew'}
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

                {/* Dynamic QR Code Card */}
                <div className="bg-surface-container/40 border border-outline-variant/25 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="p-3 bg-white rounded-2xl shadow-sm border border-neutral-200">
                        <QRCode value={joinUrl} size={190} />
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-xs font-bold text-on-surface flex items-center justify-center gap-1">
                            <span className="material-symbols-outlined text-[15px] text-primary">
                                qr_code_scanner
                            </span>
                            <span>Scan with Phone Camera</span>
                        </p>
                        <p className="text-[11px] text-on-surface-variant max-w-[240px]">
                            Point iPhone or Android camera to open SplitNest and claim your profile
                        </p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-1">
                    <button
                        type="button"
                        onClick={handleWhatsAppShare}
                        className="w-full h-11 px-3.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-[0.98] cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[18px]">
                            chat
                        </span>
                        <span>Share Invite via WhatsApp</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleCopy}
                        className="w-full h-10 px-3.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center justify-center gap-2 border border-outline-variant/30 transition-all active:scale-[0.98] cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[16px] text-primary">
                            {copied ? 'check' : 'content_copy'}
                        </span>
                        <span>{copied ? 'Link Copied!' : 'Copy App Link'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JoinTripModal;

