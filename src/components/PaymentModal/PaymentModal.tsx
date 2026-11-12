import React, { lazy, Suspense, useMemo, useState } from 'react';
import { Avatar } from '../Avatar';
import { QRCode } from '../QRCode';
import { useExpense } from '../../context';
import { triggerHaptic } from '../../utils/haptics';
import {
    buildUpiPaymentUri,
    parseUpiQrPayload,
    renderUpiQrCardToPngBlob,
    shareOrDownloadQrCard,
    type ParsedUpiQr,
} from '../../utils/qr';
import { AppIcon } from '../Icon/AppIcon';

const QrScannerModal = lazy(() => import('../QRScanner/QrScannerModal'));

export interface PaymentSettlementData {
    to: string;
    from?: string;
    amount: number;
    toUpiId?: string | null;
    upiIntent?: string;
    description?: string;
    splitId?: string;
    splitIds?: string[];
}

export interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    settlement: PaymentSettlementData | null;
}

interface PaymentModalContentProps {
    onClose: () => void;
    settlement: PaymentSettlementData;
}

const PaymentModalContent: React.FC<PaymentModalContentProps> = ({
    onClose,
    settlement,
}) => {
    const { showToast, activePerson } = useExpense();
    const hasPositiveAmount = settlement.amount > 0;
    const [includeAmountInQr, setIncludeAmountInQr] = useState(hasPositiveAmount);
    const [copiedUpi, setCopiedUpi] = useState(false);
    const [copiedAmount, setCopiedAmount] = useState(false);
    const [isSharingQr, setIsSharingQr] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [scannedQr, setScannedQr] = useState<ParsedUpiQr | null>(null);

    const savedUpiId = useMemo(() => {
        const direct = settlement.toUpiId?.trim();
        if (direct) return direct;
        if (settlement.upiIntent) {
            return parseUpiQrPayload(settlement.upiIntent)?.upiId || '';
        }
        return '';
    }, [settlement.toUpiId, settlement.upiIntent]);

    const activeUpiId = scannedQr?.upiId || savedUpiId;
    const isScannedMatch =
        Boolean(scannedQr && savedUpiId) &&
        scannedQr!.upiId.toLowerCase() === savedUpiId.toLowerCase();

    const qrValue = useMemo(() => {
        if (!activeUpiId) return '';
        return buildUpiPaymentUri({
            upiId: activeUpiId,
            payeeName: scannedQr?.payeeName || settlement.to,
            amount: settlement.amount,
            note: `Split-${settlement.description || 'Payment'}`,
            includeAmount: includeAmountInQr,
        });
    }, [activeUpiId, includeAmountInQr, scannedQr?.payeeName, settlement.amount, settlement.description, settlement.to]);

    const handleCopyUpi = async () => {
        if (!activeUpiId) return;
        try {
            await navigator.clipboard.writeText(activeUpiId);
            triggerHaptic('success');
            setCopiedUpi(true);
            showToast(`Copied UPI ID: ${activeUpiId}`, 'content_copy');
            setTimeout(() => setCopiedUpi(false), 2500);
        } catch {
            triggerHaptic('warning');
            showToast('Failed to copy UPI ID', 'error');
        }
    };

    const handleCopyAmount = async () => {
        try {
            await navigator.clipboard.writeText(settlement.amount.toString());
            triggerHaptic('light');
            setCopiedAmount(true);
            showToast(`Copied amount: ₹${settlement.amount}`, 'payments');
            setTimeout(() => setCopiedAmount(false), 2500);
        } catch {
            triggerHaptic('warning');
            showToast('Failed to copy amount', 'error');
        }
    };

    const handleShareOrSaveQr = async () => {
        if (!qrValue || isSharingQr) return;
        triggerHaptic('medium');
        setIsSharingQr(true);
        try {
            const amountLabel =
                hasPositiveAmount && includeAmountInQr
                    ? `₹${settlement.amount.toLocaleString('en-IN')}`
                    : 'Open Amount (enter in UPI app)';
            const blob = await renderUpiQrCardToPngBlob({
                value: qrValue,
                title: `Pay ${settlement.to}`,
                subtitle: settlement.description ? `For "${settlement.description}"` : 'SplitNest Settlement',
                amountLabel,
                upiId: activeUpiId,
            });
            const safeName = settlement.to.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() || 'payee';
            const shareAmtText = hasPositiveAmount ? ` ₹${settlement.amount.toLocaleString('en-IN')}` : '';
            const outcome = await shareOrDownloadQrCard(
                blob,
                `splitnest-pay-${safeName}.png`,
                `Pay ${settlement.to}${shareAmtText}`,
                `Scan QR in GPay, PhonePe, or Paytm to pay ${settlement.to} (${activeUpiId})`
            );
            if (outcome === 'shared') {
                triggerHaptic('success');
                showToast('QR card ready to share or open with UPI!', 'share');
            } else if (outcome === 'downloaded') {
                triggerHaptic('success');
                showToast('QR saved! Open GPay/PhonePe & choose "Scan from Gallery".', 'download_done');
            }
        } catch (err: unknown) {
            triggerHaptic('warning');
            showToast(`Could not export QR image: ${String(err)}`, 'error');
        } finally {
            setIsSharingQr(false);
        }
    };

    const handleScannedCreditorQr = async (parsed: ParsedUpiQr) => {
        setScannedQr(parsed);
        setShowScanner(false);
        try {
            await navigator.clipboard.writeText(parsed.upiId);
            showToast(`Scanned & copied UPI ID: ${parsed.upiId}`, 'qr_code_scanner');
        } catch {
            showToast(`Scanned UPI ID: ${parsed.upiId}`, 'qr_code_scanner');
        }
    };

    const handleShareWhatsAppPayment = () => {
        triggerHaptic('light');
        const text = `Hey ${settlement.to}, confirming payment details for ${settlement.description || 'our split'}:\n💰 Amount: ₹${settlement.amount}\n💳 Payee UPI: ${activeUpiId || 'Ask payee'}`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    };

    const handleNotifyPaidOnWhatsapp = () => {
        triggerHaptic('success');
        const payer = settlement.from || activePerson;
        const text = `Hey ${settlement.to}, I (${payer}) just paid ₹${settlement.amount} for "${settlement.description || 'Split'}" via UPI (${activeUpiId || 'QR'}). Please confirm in SplitNest!`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
        onClose();
    };

    return (
        <>
            <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
                {/* Backdrop click dismiss */}
                <div
                    className="fixed inset-0"
                    onClick={onClose}
                    aria-hidden="true"
                />

                {/* Modal Bottom Sheet Card */}
                <div className="relative z-10 w-full max-w-sm max-h-[92vh] overflow-y-auto bg-surface-container-lowest border-t sm:border border-outline-variant/30 rounded-t-3xl sm:rounded-3xl p-5 pb-safe shadow-2xl space-y-4 text-on-surface animate-in slide-in-from-bottom duration-250">
                    {/* Mobile Drawer Pull Handle Indicator */}
                    <div className="w-12 h-1 bg-outline-variant/40 rounded-full mx-auto -mt-1 mb-2 sm:hidden" />

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
                            <AppIcon name="close" className="text-[20px]" />
                        </button>
                    </div>

                    {/* Amount Hero Box + QR Mode Toggle */}
                    <div className="bg-surface-container/60 border border-outline-variant/25 rounded-2xl p-3.5 text-center space-y-2.5">
                        <div>
                            <span className="text-[10px] tracking-wider uppercase font-semibold text-on-surface-variant">
                                Amount to Pay
                            </span>
                            <div className="text-3xl font-extrabold font-mono text-primary flex items-center justify-center gap-1.5 mt-0.5">
                                {hasPositiveAmount ? (
                                    <>
                                        <span>₹{settlement.amount.toLocaleString('en-IN')}</span>
                                        <button
                                            type="button"
                                            onClick={() => void handleCopyAmount()}
                                            className="p-1 rounded-md text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                            title="Copy amount"
                                            aria-label="Copy amount"
                                        >
                                            <AppIcon name={copiedAmount ? 'check' : 'content_copy'} className="text-[16px]" />
                                        </button>
                                    </>
                                ) : (
                                    <span className="text-lg">Enter Amount in UPI App</span>
                                )}
                            </div>
                        </div>

                        {activeUpiId && hasPositiveAmount && (
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
                                    Fixed ₹{settlement.amount.toLocaleString('en-IN')}
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

                    {/* Scannable / Shareable QR Code OR Camera Scan CTA */}
                    {activeUpiId ? (
                        <div className="bg-surface-container/40 border border-outline-variant/25 rounded-2xl p-4 flex flex-col items-center text-center space-y-3">
                            <div className="p-3 bg-white rounded-2xl shadow-sm border border-neutral-200">
                                <QRCode value={qrValue} size={188} />
                            </div>

                            <div className="space-y-0.5">
                                <p className="text-xs font-bold text-on-surface">
                                    {hasPositiveAmount && includeAmountInQr
                                        ? `QR Locked for ₹${settlement.amount.toLocaleString('en-IN')}`
                                        : 'Open Amount QR (enter amount in app)'}
                                </p>
                                <p className="text-[11px] text-on-surface-variant max-w-[260px]">
                                    Save/Share this QR to open from <strong>Scan Gallery</strong> in PhonePe, GPay, or Paytm on this phone — or scan {settlement.to}&apos;s QR directly.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 w-full">
                                <button
                                    type="button"
                                    disabled={isSharingQr}
                                    onClick={() => void handleShareOrSaveQr()}
                                    className="h-10 px-3 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs hover:bg-primary/90 active:scale-[0.98] transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    <AppIcon name={isSharingQr ? 'hourglass_top' : 'ios_share'} className="text-[16px]" />
                                    <span>{isSharingQr ? 'Preparing...' : 'Save / Share QR'}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic('light');
                                        setShowScanner(true);
                                    }}
                                    className="h-10 px-3 rounded-xl bg-surface-container-high hover:bg-surface-container text-on-surface font-semibold text-xs flex items-center justify-center gap-1.5 border border-outline-variant/30 active:scale-[0.98] transition-colors cursor-pointer"
                                >
                                    <AppIcon name="qr_code_scanner" className="text-[16px] text-primary" />
                                    <span>Scan QR</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-tertiary-container/30 border border-tertiary/30 rounded-2xl p-4 space-y-3">
                            <div className="flex items-start gap-2 text-xs text-on-tertiary-container">
                                <AppIcon name="warning" className="text-[18px] text-tertiary shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold block">No UPI ID saved for {settlement.to}</span>
                                    <span>Point your camera at {settlement.to}&apos;s PhonePe/GPay QR to read &amp; copy their UPI ID instantly.</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic('medium');
                                    setShowScanner(true);
                                }}
                                className="w-full h-11 rounded-xl bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-2 shadow-xs hover:bg-primary/90 active:scale-[0.98] transition-colors cursor-pointer"
                            >
                                <AppIcon name="qr_code_scanner" className="text-[18px]" />
                                <span>Open Camera &amp; Scan {settlement.to}&apos;s QR</span>
                            </button>
                        </div>
                    )}

                    {/* 1-Tap Copy UPI ID Card */}
                    {activeUpiId && (
                        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                                    <AppIcon name={scannedQr ? 'qr_code_scanner' : 'verified'} className="text-[15px]" />
                                    <span>
                                        {scannedQr
                                            ? isScannedMatch
                                                ? 'Scanned QR Verified'
                                                : 'Scanned Creditor UPI ID'
                                            : '1-Tap Copy UPI ID'}
                                    </span>
                                </span>
                                {scannedQr && (
                                    <button
                                        type="button"
                                        onClick={() => setScannedQr(null)}
                                        className="text-[10px] font-semibold text-on-surface-variant hover:text-primary cursor-pointer"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-3 py-2">
                                <span className="font-mono text-xs text-on-surface font-semibold truncate flex-1 select-all">
                                    {activeUpiId}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => void handleCopyUpi()}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                                        copiedUpi
                                            ? 'bg-primary text-on-primary shadow-xs'
                                            : 'bg-primary/10 text-primary hover:bg-primary hover:text-on-primary'
                                    }`}
                                >
                                    <AppIcon name={copiedUpi ? 'check' : 'content_copy'} className="text-[14px]" />
                                    <span>{copiedUpi ? 'Copied!' : 'Copy'}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Payment Confirmation / WhatsApp Actions */}
                    <div className="space-y-2">
                        <button
                            type="button"
                            onClick={handleNotifyPaidOnWhatsapp}
                            className="w-full h-11 px-3.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors active:scale-[0.98] cursor-pointer"
                        >
                            <AppIcon name="task_alt" className="text-[18px]" />
                            <span>I&apos;ve Paid — Notify {settlement.to} on WhatsApp</span>
                        </button>

                        {activeUpiId && (
                            <button
                                type="button"
                                onClick={handleShareWhatsAppPayment}
                                className="w-full h-9 px-3.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-semibold text-xs flex items-center justify-center gap-1.5 border border-outline-variant/30 transition-colors cursor-pointer"
                            >
                                <AppIcon name="share" className="text-[16px] text-primary" />
                                <span>Copy &amp; Share Details via WhatsApp</span>
                            </button>
                        )}
                    </div>

                    <p className="text-[11px] text-on-surface-variant text-center leading-relaxed">
                        Once you transfer{hasPositiveAmount ? ` ₹${settlement.amount.toLocaleString('en-IN')}` : ''},{' '}
                        <strong className="text-on-surface">{settlement.to}</strong> taps <strong>Confirm</strong> in SplitNest to mark this settled.
                    </p>
                </div>
            </div>

            {showScanner && (
                <Suspense fallback={null}>
                    <QrScannerModal
                        isOpen={showScanner}
                        onClose={() => setShowScanner(false)}
                        onScanUpi={(parsed) => void handleScannedCreditorQr(parsed)}
                        title={`Scan ${settlement.to}'s QR`}
                        subtitle="Read creditor's UPI ID via camera or gallery"
                    />
                </Suspense>
            )}
        </>
    );
};

export const PaymentModal: React.FC<PaymentModalProps> = ({
    isOpen,
    onClose,
    settlement,
}) => {
    if (!isOpen || !settlement) return null;

    return (
        <PaymentModalContent
            key={`${settlement.to}-${settlement.amount}-${settlement.description || ''}`}
            onClose={onClose}
            settlement={settlement}
        />
    );
};

export default PaymentModal;
