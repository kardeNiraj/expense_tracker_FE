import React, { useState } from 'react';
import { Avatar } from '../Avatar';
import { QRCode } from '../QRCode';
import { useExpense } from '../../context';
import { usePeopleDetails, useUpdateUpiMutation, useSettleParticipantMutation } from '../../api';
import { triggerHaptic } from '../../utils/haptics';

export interface CollectQrModalData {
    debtorName: string;
    amount: number;
    splitId?: string;
    splitIds?: string[];
    description?: string;
}

export interface CollectQrModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: CollectQrModalData | null;
    onConfirmedSettled?: () => void;
}

interface CollectQrContentProps {
    onClose: () => void;
    data: CollectQrModalData;
    onConfirmedSettled?: () => void;
}

const CollectQrContent: React.FC<CollectQrContentProps> = ({
    onClose,
    data,
    onConfirmedSettled,
}) => {
    const { activePerson, claimedPerson, showToast } = useExpense();
    const { data: peopleDetails = [] } = usePeopleDetails();
    const updateUpiMutation = useUpdateUpiMutation();
    const settleMutation = useSettleParticipantMutation();

    const myDetail = peopleDetails.find(
        (p) => p.name.toLowerCase() === activePerson.toLowerCase()
    );
    const myUpiId = myDetail?.upiId?.trim() || '';

    const [upiInput, setUpiInput] = useState(myUpiId);
    const [isEditingUpi, setIsEditingUpi] = useState(false);
    const [isSavingUpi, setIsSavingUpi] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isSettling, setIsSettling] = useState(false);

    const handleSaveUpi = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = upiInput.trim();
        if (!trimmed || !trimmed.includes('@')) {
            showToast('Please enter a valid UPI ID (e.g. name@okhdfcbank)', 'warning');
            return;
        }

        setIsSavingUpi(true);
        try {
            await updateUpiMutation.mutateAsync({
                name: activePerson,
                upiId: trimmed,
                requestedBy: claimedPerson || activePerson,
            });
            triggerHaptic('success');
            showToast('UPI ID saved successfully!', 'check_circle');
            setIsEditingUpi(false);
        } catch (err: unknown) {
            triggerHaptic('warning');
            showToast(`Failed to save UPI ID: ${String(err)}`, 'error');
        } finally {
            setIsSavingUpi(false);
        }
    };

    const handleConfirmReceived = async () => {
        setIsSettling(true);
        try {
            const targetSplitIds =
                data.splitIds && data.splitIds.length > 0
                    ? data.splitIds
                    : data.splitId
                      ? [data.splitId]
                      : [];

            if (targetSplitIds.length === 0) {
                throw new Error('No split ID provided for settlement');
            }

            for (const sId of targetSplitIds) {
                await settleMutation.mutateAsync({
                    splitId: sId,
                    from: data.debtorName,
                    to: activePerson,
                    confirmedBy: activePerson,
                    settled: true,
                });
            }

            triggerHaptic('success');
            showToast(
                `Payment of ₹${data.amount.toLocaleString('en-IN')} from ${data.debtorName} marked settled!`,
                'check_circle'
            );
            onClose();
            onConfirmedSettled?.();
        } catch (err: unknown) {
            triggerHaptic('warning');
            showToast(`Failed to settle: ${String(err)}`, 'error');
        } finally {
            setIsSettling(false);
        }
    };

    const handleCopyUpi = async () => {
        if (!myUpiId) return;
        try {
            await navigator.clipboard.writeText(myUpiId);
            triggerHaptic('success');
            setCopied(true);
            showToast(`Copied UPI ID: ${myUpiId}`, 'content_copy');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            triggerHaptic('warning');
        }
    };

    const encodedUpiId = encodeURIComponent(myUpiId);
    const encodedName = encodeURIComponent(activePerson);
    const note = `${data.debtorName} to ${activePerson} (${data.description || 'SplitNest'})`.slice(0, 30);
    const encodedNote = encodeURIComponent(note);

    const upiUrl = myUpiId
        ? `upi://pay?pa=${encodedUpiId}&pn=${encodedName}&am=${data.amount}&cu=INR&tn=${encodedNote}`
        : '';

    const handleShareWhatsApp = () => {
        if (!myUpiId) return;
        const msg = `Hey ${data.debtorName}! Here's the payment request for ₹${data.amount.toLocaleString('en-IN')}${data.description ? ` (${data.description})` : ''}.\n\nUPI Link: ${upiUrl}\n\nOr pay to UPI ID: ${myUpiId}`;
        const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl border border-outline-variant/30 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Drag Handle (Mobile) */}
                <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
                    <div className="w-10 h-1 rounded-full bg-outline-variant/60" />
                </div>

                {/* Modal Header */}
                <div className="p-4 border-b border-outline-variant/20 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={data.debtorName} size="md" />
                        <div className="min-w-0">
                            <h3 className="font-bold text-base text-on-surface truncate">
                                Collect from {data.debtorName}
                            </h3>
                            <p className="text-xs text-on-surface-variant truncate">
                                {data.description || 'Split dues'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer shrink-0"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 overflow-y-auto space-y-4">
                    {/* Amount Banner */}
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-center">
                        <span className="text-[11px] font-bold text-primary tracking-wider uppercase">
                            Amount to Collect
                        </span>
                        <div className="text-3xl font-extrabold text-on-surface tracking-tight font-mono mt-0.5">
                            ₹{data.amount.toLocaleString('en-IN')}
                        </div>
                    </div>

                    {/* Case 1: Creditor has no UPI ID registered or is editing it */}
                    {(!myUpiId || isEditingUpi) ? (
                        <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/30 space-y-3">
                            <div className="flex items-start gap-2.5">
                                <span className="material-symbols-outlined text-secondary text-[22px] mt-0.5 shrink-0">
                                    account_balance_wallet
                                </span>
                                <div>
                                    <h4 className="font-bold text-sm text-on-surface">
                                        {myUpiId ? 'Update your UPI ID' : 'Add your UPI ID to receive payments'}
                                    </h4>
                                    <p className="text-xs text-on-surface-variant mt-0.5">
                                        {data.debtorName} will scan your QR to transfer directly into this account.
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleSaveUpi} className="space-y-2.5 pt-1">
                                <input
                                    type="text"
                                    inputMode="email"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    value={upiInput}
                                    onChange={(e) => setUpiInput(e.target.value)}
                                    placeholder="e.g. yourname@okhdfcbank"
                                    className="w-full h-11 px-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant text-sm font-mono focus:outline-hidden focus:border-primary"
                                    required
                                />
                                <div className="flex items-center gap-2">
                                    {isEditingUpi && myUpiId && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setUpiInput(myUpiId);
                                                setIsEditingUpi(false);
                                            }}
                                            className="h-10 px-3 rounded-xl border border-outline-variant/40 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={isSavingUpi}
                                        className="flex-1 h-10 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-xs hover:bg-primary/90 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">
                                            qr_code_2
                                        </span>
                                        <span>{isSavingUpi ? 'Saving...' : 'Save & Show QR Code'}</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        /* Case 2: UPI ID is available - Display QR Code & Actions */
                        <div className="space-y-4">
                            {/* In-Person QR Code Card */}
                            <div className="flex flex-col items-center justify-center p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30">
                                <div className="bg-white p-3 rounded-xl shadow-xs border border-outline-variant/20 mb-2.5">
                                    <QRCode value={upiUrl} size={210} />
                                </div>
                                <p className="text-[11px] font-medium text-on-surface-variant text-center">
                                    Show this to {data.debtorName} to scan with Google Pay, PhonePe, Paytm, or BHIM
                                </p>
                            </div>

                            {/* Receiving UPI ID Details */}
                            <div className="flex items-center justify-between px-3 py-2 bg-surface-container-low/70 rounded-xl border border-outline-variant/20 text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-[11px] font-bold text-outline uppercase font-mono">
                                        UPI
                                    </span>
                                    <span className="font-mono text-on-surface truncate">
                                        {myUpiId}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={handleCopyUpi}
                                        className="px-2 py-1 rounded-md text-primary font-semibold hover:bg-primary/10 transition-colors flex items-center gap-1 cursor-pointer"
                                        title="Copy UPI ID"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">
                                            {copied ? 'check' : 'content_copy'}
                                        </span>
                                        <span>{copied ? 'Copied' : 'Copy'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setUpiInput(myUpiId);
                                            setIsEditingUpi(true);
                                        }}
                                        className="p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                                        title="Change UPI ID"
                                    >
                                        <span className="material-symbols-outlined text-[15px]">edit</span>
                                    </button>
                                </div>
                            </div>

                            {/* Share on WhatsApp option (if friend is remote or wants link) */}
                            <button
                                type="button"
                                onClick={handleShareWhatsApp}
                                className="w-full h-10 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-container transition-colors cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[#25D366] text-[18px]">
                                    chat
                                </span>
                                <span>Share Payment Link on WhatsApp</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer Action: Settle Confirmation */}
                <div className="p-4 border-t border-outline-variant/20 bg-surface-container-lowest">
                    <button
                        type="button"
                        disabled={isSettling}
                        onClick={handleConfirmReceived}
                        className="w-full h-12 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            {isSettling ? 'hourglass_top' : 'done_all'}
                        </span>
                        <span>
                            {isSettling
                                ? 'Confirming...'
                                : `Confirm Received ₹${data.amount.toLocaleString('en-IN')} from ${data.debtorName}`}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export const CollectQrModal: React.FC<CollectQrModalProps> = ({
    isOpen,
    onClose,
    data,
    onConfirmedSettled,
}) => {
    if (!isOpen || !data) return null;

    return (
        <CollectQrContent
            key={`${data.debtorName}-${data.amount}-${data.splitId || ''}-${data.splitIds?.join(',') || ''}`}
            onClose={onClose}
            data={data}
            onConfirmedSettled={onConfirmedSettled}
        />
    );
};
