import React, { lazy, Suspense, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar } from '../Avatar';
import { QRCode } from '../QRCode';
import { useExpense } from '../../context';
import { usePeopleDetails, useUpdateUpiMutation, useSettleParticipantMutation, type Split } from '../../api';
import { triggerHaptic } from '../../utils/haptics';
import {
    buildUpiPaymentUri,
    renderUpiQrCardToPngBlob,
    shareOrDownloadQrCard,
    type ParsedUpiQr,
} from '../../utils/qr';
import { AppIcon } from '../Icon/AppIcon';

const QrScannerModal = lazy(() => import('../QRScanner/QrScannerModal'));

export interface CollectQrSettlementRef {
    splitId: string;
    from: string;
    to: string;
}

export interface CollectQrModalData {
    debtorName: string;
    amount: number;
    splitId?: string;
    splitIds?: string[];
    settlementRefs?: CollectQrSettlementRef[];
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
    const queryClient = useQueryClient();
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
    const [includeAmountInQr, setIncludeAmountInQr] = useState(true);
    const [isSharingQr, setIsSharingQr] = useState(false);
    const [showScanner, setShowScanner] = useState(false);

    const qrValue = useMemo(() => {
        if (!myUpiId) return '';
        return buildUpiPaymentUri({
            upiId: myUpiId,
            payeeName: activePerson,
            amount: data.amount,
            note: `${data.debtorName} to ${activePerson} (${data.description || 'SplitNest'})`,
            includeAmount: includeAmountInQr,
        });
    }, [activePerson, data.amount, data.debtorName, data.description, includeAmountInQr, myUpiId]);

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

    const resolveCachedSplitId = (rawSplitId: string): string => {
        if (!rawSplitId.startsWith('offline_')) return rawSplitId;
        const cachedLists = queryClient.getQueriesData<Split[]>({ queryKey: ['splits'] });
        const flatSplits = cachedLists.flatMap(([, list]) => list || []);
        const currentSplit = flatSplits.find((s) => s.splitId === rawSplitId);
        if (!currentSplit) return rawSplitId;
        const matchedServerSplit = flatSplits.find(
            (s) =>
                !s.splitId.startsWith('offline_') &&
                s.description === currentSplit.description &&
                s.totalAmount === currentSplit.totalAmount &&
                s.paidBy.toLowerCase() === currentSplit.paidBy.toLowerCase()
        );
        return matchedServerSplit ? matchedServerSplit.splitId : rawSplitId;
    };

    const handleConfirmReceived = async () => {
        setIsSettling(true);
        try {
            if (data.settlementRefs && data.settlementRefs.length > 0) {
                await Promise.all(
                    data.settlementRefs.map((ref) =>
                        settleMutation.mutateAsync({
                            splitId: resolveCachedSplitId(ref.splitId),
                            from: ref.from,
                            to: ref.to,
                            confirmedBy: activePerson,
                            settled: true,
                        })
                    )
                );
            } else {
                const targetSplitIds =
                    data.splitIds && data.splitIds.length > 0
                        ? data.splitIds
                        : data.splitId
                          ? [data.splitId]
                          : [];

                if (targetSplitIds.length === 0) {
                    throw new Error('No split ID provided for settlement');
                }

                await Promise.all(
                    targetSplitIds.map((sId) =>
                        settleMutation.mutateAsync({
                            splitId: resolveCachedSplitId(sId),
                            from: data.debtorName,
                            to: activePerson,
                            confirmedBy: activePerson,
                            settled: true,
                        })
                    )
                );
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

    const handleShareOrSaveQr = async () => {
        if (!qrValue || isSharingQr) return;
        triggerHaptic('medium');
        setIsSharingQr(true);
        const shareText = `Hey ${data.debtorName}! Payment request for ₹${data.amount.toLocaleString('en-IN')}${data.description ? ` (${data.description})` : ''}.\n\nPay to ${activePerson} (UPI: ${myUpiId})\nSave this QR & scan from Gallery in PhonePe, GPay, or Paytm.`;
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(shareText).catch(() => {});
        }
        try {
            const amountLabel = includeAmountInQr
                ? `₹${data.amount.toLocaleString('en-IN')}`
                : `Open QR • Share ₹${data.amount.toLocaleString('en-IN')}`;
            const blob = await renderUpiQrCardToPngBlob({
                value: qrValue,
                title: `Pay ${activePerson}`,
                payerLabel: `For ${data.debtorName}`,
                subtitle: data.description || `Collect from ${data.debtorName}`,
                amountLabel,
                upiId: myUpiId,
            });
            const safeDebtor = data.debtorName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() || 'friend';
            const fileName = includeAmountInQr
                ? `splitnest-${safeDebtor}-${Math.round(data.amount)}.png`
                : `splitnest-${safeDebtor}.png`;
            const outcome = await shareOrDownloadQrCard(
                blob,
                fileName,
                `Pay ${activePerson} — ${data.debtorName} (₹${data.amount.toLocaleString('en-IN')})`,
                shareText
            );
            if (outcome === 'shared') {
                triggerHaptic('success');
                showToast('QR card ready to share! Message also copied.', 'share');
            } else if (outcome === 'downloaded') {
                triggerHaptic('success');
                showToast('QR image saved & message copied for ' + data.debtorName + '.', 'download_done');
            }
        } catch (err: unknown) {
            triggerHaptic('warning');
            showToast(`Could not export QR image: ${String(err)}`, 'error');
        } finally {
            setIsSharingQr(false);
        }
    };

    const handleShareWhatsApp = () => {
        if (!myUpiId) return;
        const msg = `Hey ${data.debtorName}! Payment request for ₹${data.amount.toLocaleString('en-IN')}${data.description ? ` (${data.description})` : ''}.\n\nPay to UPI ID: ${myUpiId}\nPayee: ${activePerson}`;
        const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
    };

    const handleScannedOwnQr = (parsed: ParsedUpiQr) => {
        setUpiInput(parsed.upiId);
        setShowScanner(false);
        showToast(`Loaded UPI ID: ${parsed.upiId}`, 'qr_code_scanner');
    };

    return (
        <>
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-xs z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
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
                            aria-label="Close"
                        >
                            <AppIcon name="close" className="text-[20px]" />
                        </button>
                    </div>

                    {/* Body Content */}
                    <div className="p-5 overflow-y-auto space-y-4">
                        {/* Amount Banner + Fixed/Open QR Toggle */}
                        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3.5 text-center space-y-2.5">
                            <div>
                                <span className="text-[11px] font-bold text-primary tracking-wider uppercase">
                                    Amount to Collect
                                </span>
                                <div className="text-3xl font-extrabold text-on-surface tracking-tight font-mono mt-0.5">
                                    ₹{data.amount.toLocaleString('en-IN')}
                                </div>
                            </div>

                            {myUpiId && !isEditingUpi && (
                                <div className="grid grid-cols-2 gap-1 bg-surface-container-lowest p-1 rounded-xl border border-outline-variant/25 text-[11px] font-semibold">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic('light');
                                            setIncludeAmountInQr(true);
                                        }}
                                        className={`h-7 rounded-lg transition-colors cursor-pointer ${
                                            includeAmountInQr
                                                ? 'bg-primary text-on-primary shadow-xs font-bold'
                                                : 'text-on-surface-variant hover:text-on-surface'
                                        }`}
                                    >
                                        Fixed ₹{data.amount.toLocaleString('en-IN')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic('light');
                                            setIncludeAmountInQr(false);
                                        }}
                                        className={`h-7 rounded-lg transition-colors cursor-pointer ${
                                            !includeAmountInQr
                                                ? 'bg-primary text-on-primary shadow-xs font-bold'
                                                : 'text-on-surface-variant hover:text-on-surface'
                                        }`}
                                    >
                                        Open Amount
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Case 1: Creditor has no UPI ID registered or is editing it */}
                        {(!myUpiId || isEditingUpi) ? (
                            <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/30 space-y-3">
                                <div className="flex items-start justify-between gap-2.5">
                                    <div className="flex items-start gap-2.5">
                                        <AppIcon name="account_balance_wallet" className="text-secondary text-[22px] mt-0.5 shrink-0" />
                                        <div>
                                            <h4 className="font-bold text-sm text-on-surface">
                                                {myUpiId ? 'Update your UPI ID' : 'Add your UPI ID to receive payments'}
                                            </h4>
                                            <p className="text-xs text-on-surface-variant mt-0.5">
                                                {data.debtorName} will scan your QR to transfer directly into this account.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <form onSubmit={handleSaveUpi} className="space-y-2.5 pt-1">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            inputMode="email"
                                            autoCapitalize="none"
                                            autoCorrect="off"
                                            value={upiInput}
                                            onChange={(e) => setUpiInput(e.target.value)}
                                            placeholder="e.g. yourname@okhdfcbank"
                                            className="flex-1 h-11 px-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant text-sm font-mono focus:outline-hidden focus:border-primary"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                triggerHaptic('light');
                                                setShowScanner(true);
                                            }}
                                            className="h-11 px-3 rounded-xl bg-surface-container border border-outline-variant/40 text-primary hover:bg-primary/10 text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                                            title="Scan your UPI QR screenshot or card"
                                        >
                                            <AppIcon name="qr_code_scanner" className="text-[18px]" />
                                            <span>Scan</span>
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isEditingUpi && myUpiId && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setUpiInput(myUpiId);
                                                    setIsEditingUpi(false);
                                                }}
                                                className="h-10 px-3 rounded-xl border border-outline-variant/40 text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={isSavingUpi}
                                            className="flex-1 h-10 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-xs hover:bg-primary/90 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                                        >
                                            <AppIcon name="qr_code_2" className="text-[16px]" />
                                            <span>{isSavingUpi ? 'Saving...' : 'Save & Show QR Code'}</span>
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            /* Case 2: UPI ID is available - Display QR Code & Actions */
                            <div className="space-y-3.5">
                                {/* In-Person QR Code Card */}
                                <div className="flex flex-col items-center justify-center p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30 space-y-2.5">
                                    <div className="bg-white p-3 rounded-xl shadow-xs border border-outline-variant/20">
                                        <QRCode value={qrValue} size={205} />
                                    </div>
                                    <p className="text-[11px] font-medium text-on-surface-variant text-center">
                                        Show this to {data.debtorName} to scan with Google Pay, PhonePe, Paytm, or BHIM
                                    </p>

                                    <div className="grid grid-cols-2 gap-2 w-full pt-0.5">
                                        <button
                                            type="button"
                                            disabled={isSharingQr}
                                            onClick={() => void handleShareOrSaveQr()}
                                            className="h-9 px-3 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-on-primary text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            <AppIcon name={isSharingQr ? 'hourglass_top' : 'ios_share'} className="text-[16px]" />
                                            <span>{isSharingQr ? 'Saving...' : 'Share / Save QR'}</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleShareWhatsApp}
                                            className="h-9 px-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-container transition-colors cursor-pointer"
                                        >
                                            <AppIcon name="chat" className="text-[#25D366] text-[17px]" />
                                            <span>WhatsApp</span>
                                        </button>
                                    </div>
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
                                            onClick={() => void handleCopyUpi()}
                                            className="px-2 py-1 rounded-md text-primary font-semibold hover:bg-primary/10 transition-colors flex items-center gap-1 cursor-pointer"
                                            title="Copy UPI ID"
                                        >
                                            <AppIcon name={copied ? 'check' : 'content_copy'} className="text-[14px]" />
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
                                            <AppIcon name="edit" className="text-[15px]" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Action: Settle Confirmation */}
                    <div className="p-4 pb-safe border-t border-outline-variant/20 bg-surface-container-lowest">
                        <button
                            type="button"
                            disabled={isSettling}
                            onClick={() => void handleConfirmReceived()}
                            className="w-full h-12 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            <AppIcon name={isSettling ? 'hourglass_top' : 'done_all'} className="text-[20px]" />
                            <span>
                                {isSettling
                                    ? 'Confirming...'
                                    : `Confirm Received ₹${data.amount.toLocaleString('en-IN')} from ${data.debtorName}`}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {showScanner && (
                <Suspense fallback={null}>
                    <QrScannerModal
                        isOpen={showScanner}
                        onClose={() => setShowScanner(false)}
                        onScanUpi={handleScannedOwnQr}
                        title="Scan Your UPI QR"
                        subtitle="Auto-fill your UPI ID from camera or screenshot"
                    />
                </Suspense>
            )}
        </>
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
            key={`${data.debtorName}-${data.amount}-${data.splitId || ''}-${data.splitIds?.join(',') || ''}-${data.settlementRefs?.map((r) => `${r.splitId}:${r.from}->${r.to}`).join(',') || ''}`}
            onClose={onClose}
            data={data}
            onConfirmedSettled={onConfirmedSettled}
        />
    );
};
