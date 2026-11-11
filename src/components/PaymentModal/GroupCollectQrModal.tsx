import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '../Avatar';
import { QRCode } from '../QRCode';
import { useExpense } from '../../context';
import { usePeopleDetails, useUpdateUpiMutation } from '../../api';
import { triggerHaptic } from '../../utils/haptics';
import {
    buildUpiPaymentUri,
    downloadQrCards,
    renderUpiQrCardToPngBlob,
    shareOrDownloadQrCard,
    shareQrCardFiles,
    type ParsedUpiQr,
    type QrCardShareItem,
} from '../../utils/qr';

const QrScannerModal = lazy(() => import('../QRScanner/QrScannerModal'));

export interface GroupCollectDebtorItem {
    debtorName: string;
    amount: number;
    description: string;
    splitCount?: number;
}

export interface GroupCollectQrModalData {
    title: string;
    subtitle?: string;
    debtors: GroupCollectDebtorItem[];
}

export interface GroupCollectQrModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: GroupCollectQrModalData | null;
}

interface GroupCollectQrContentProps {
    onClose: () => void;
    data: GroupCollectQrModalData;
}

interface PreparedQrCard {
    key: string;
    uri: string;
    blob: Blob;
    file: File;
    fileName: string;
}

const getDebtorKey = (name: string) => name.trim().toLowerCase();

const GroupCollectQrContent: React.FC<GroupCollectQrContentProps> = ({
    onClose,
    data,
}) => {
    const { activePerson, claimedPerson, showToast } = useExpense();
    const { data: peopleDetails = [] } = usePeopleDetails();
    const updateUpiMutation = useUpdateUpiMutation();

    const myDetail = peopleDetails.find(
        (p) => p.name.toLowerCase() === activePerson.toLowerCase()
    );
    const myUpiId = myDetail?.upiId?.trim() || '';

    const [upiInput, setUpiInput] = useState(myUpiId);
    const [isEditingUpi, setIsEditingUpi] = useState(false);
    const [isSavingUpi, setIsSavingUpi] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [includeAmountInQr, setIncludeAmountInQr] = useState(true);
    const [selectedKeys, setSelectedKeys] = useState<string[]>(() =>
        data.debtors.map((d) => getDebtorKey(d.debtorName))
    );
    const [isSharingBatch, setIsSharingBatch] = useState(false);
    const [isDownloadingAll, setIsDownloadingAll] = useState(false);
    const [sharingSingleKey, setSharingSingleKey] = useState<string | null>(null);
    const [copiedMsg, setCopiedMsg] = useState(false);
    const [copiedUpi, setCopiedUpi] = useState(false);
    const [preparedCards, setPreparedCards] = useState<Record<string, PreparedQrCard>>({});
    const [isOpenCardReady, setIsOpenCardReady] = useState(false);

    const preparedCardsRef = useRef<Record<string, PreparedQrCard>>({});
    const preparedSignatureRef = useRef<string>('');
    const preparedOpenCardRef = useRef<PreparedQrCard | null>(null);
    const preparedOpenSigRef = useRef<string>('');

    const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
    const selectedDebtors = useMemo(
        () => data.debtors.filter((d) => selectedKeySet.has(getDebtorKey(d.debtorName))),
        [data.debtors, selectedKeySet]
    );

    const totalSelectedAmount = useMemo(
        () =>
            Math.round(
                selectedDebtors.reduce((sum, d) => sum + d.amount, 0) * 100
            ) / 100,
        [selectedDebtors]
    );

    const openQrUri = useMemo(() => {
        if (!myUpiId) return '';
        return buildUpiPaymentUri({
            upiId: myUpiId,
            payeeName: activePerson,
            note: data.subtitle || `Pay ${activePerson}`,
            includeAmount: false,
        });
    }, [activePerson, data.subtitle, myUpiId]);

    const buildDebtorUri = useCallback(
        (debtor: GroupCollectDebtorItem) => {
            if (!myUpiId) return '';
            const roundedAmount = Math.round(debtor.amount * 100) / 100;
            return buildUpiPaymentUri({
                upiId: myUpiId,
                payeeName: activePerson,
                amount: roundedAmount,
                note: `${debtor.debtorName} to ${activePerson}`,
                includeAmount: true,
            });
        },
        [activePerson, myUpiId]
    );

    const renderDebtorCard = useCallback(
        async (debtor: GroupCollectDebtorItem): Promise<PreparedQrCard> => {
            const uri = buildDebtorUri(debtor);
            const roundedAmount = Math.round(debtor.amount * 100) / 100;
            const amountLabel = `₹${debtor.amount.toLocaleString('en-IN')}`;
            const blob = await renderUpiQrCardToPngBlob({
                value: uri,
                title: `Pay ${activePerson}`,
                payerLabel: `For ${debtor.debtorName}`,
                subtitle: debtor.description || data.subtitle || 'SplitNest Settlement',
                amountLabel,
                upiId: myUpiId,
            });
            const safeDebtor =
                debtor.debtorName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() || 'member';
            const fileName = `splitnest-${safeDebtor}-${Math.round(roundedAmount)}.png`;
            const file = new File([blob], fileName, { type: 'image/png' });
            return {
                key: getDebtorKey(debtor.debtorName),
                uri,
                blob,
                file,
                fileName,
            };
        },
        [activePerson, buildDebtorUri, data.subtitle, myUpiId]
    );

    const renderOpenQrCard = useCallback(async (): Promise<PreparedQrCard> => {
        const blob = await renderUpiQrCardToPngBlob({
            value: openQrUri,
            title: `Pay ${activePerson}`,
            payerLabel: 'Open Amount QR',
            subtitle: data.subtitle || 'Scan & enter your share in UPI app',
            amountLabel: 'Enter Your Share',
            upiId: myUpiId,
        });
        const safeCreditor =
            activePerson.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() || 'payee';
        const fileName = `splitnest-pay-${safeCreditor}-open.png`;
        const file = new File([blob], fileName, { type: 'image/png' });
        return {
            key: '__open__',
            uri: openQrUri,
            blob,
            file,
            fileName,
        };
    }, [activePerson, data.subtitle, myUpiId, openQrUri]);

    const currentBatchSignature = useMemo(() => {
        const debtorSig = data.debtors
            .map((d) => `${d.debtorName}:${d.amount}:${d.description}`)
            .join('|');
        return `${myUpiId}::${activePerson}::${data.subtitle || ''}::${debtorSig}`;
    }, [activePerson, data.debtors, data.subtitle, myUpiId]);

    const currentOpenSignature = useMemo(
        () => `${myUpiId}::${activePerson}::${data.subtitle || ''}::${openQrUri}`,
        [activePerson, data.subtitle, myUpiId, openQrUri]
    );

    // Proactively pre-render PNG Files for whichever tab is active so Share Sheet
    // opens synchronously on tap (preserving iOS Safari transient user activation).
    useEffect(() => {
        if (!myUpiId || isEditingUpi || data.debtors.length === 0) {
            return;
        }
        let cancelled = false;

        if (includeAmountInQr) {
            const sig = currentBatchSignature;
            void Promise.all(
                data.debtors.map(async (debtor) => {
                    const card = await renderDebtorCard(debtor);
                    return [card.key, card] as const;
                })
            )
                .then((entries) => {
                    if (cancelled) return;
                    const nextMap = Object.fromEntries(entries);
                    preparedCardsRef.current = nextMap;
                    preparedSignatureRef.current = sig;
                    setPreparedCards(nextMap);
                })
                .catch(() => {
                    // On-demand fallback in click handlers will surface errors if any
                });
        } else {
            const openSig = currentOpenSignature;
            void renderOpenQrCard()
                .then((card) => {
                    if (cancelled) return;
                    preparedOpenCardRef.current = card;
                    preparedOpenSigRef.current = openSig;
                    setIsOpenCardReady(true);
                })
                .catch(() => {
                    // On-demand fallback in click handlers will surface errors if any
                });
        }

        return () => {
            cancelled = true;
        };
    }, [
        currentBatchSignature,
        currentOpenSignature,
        data.debtors,
        includeAmountInQr,
        isEditingUpi,
        myUpiId,
        renderDebtorCard,
        renderOpenQrCard,
    ]);

    const whatsappMessage = useMemo(() => {
        if (!myUpiId) return '';
        const origin = typeof window !== 'undefined' ? window.location.origin : '';

        if (!includeAmountInQr && selectedDebtors.length === 0) {
            return [
                `💸 *UPI Collect QR — Pay ${activePerson}*`,
                data.subtitle ? `📍 ${data.subtitle}` : '',
                `💳 *UPI ID:* ${myUpiId}`,
                '',
                '📸 *How to pay:* Save the QR card above → open *PhonePe / GPay / Paytm* → *Scan from Gallery* & enter your share.',
                origin ? `🔗 ${origin}` : '',
            ]
                .filter((line, idx, arr) => {
                    if (line === '') return idx > 0 && arr[idx - 1] !== '';
                    return true;
                })
                .join('\n');
        }

        if (selectedDebtors.length === 0) return '';

        const lines = selectedDebtors.map((d) => {
            const desc = d.description ? ` _(${d.description})_` : '';
            return `• *${d.debtorName}*: ₹${d.amount.toLocaleString('en-IN')}${desc}`;
        });

        return [
            includeAmountInQr
                ? `💸 *Settle-Up QR Cards — Pay ${activePerson}*`
                : `💸 *Group Collect QR — Pay ${activePerson}*`,
            data.subtitle ? `📍 ${data.subtitle}` : '',
            `💳 *UPI ID:* ${myUpiId}`,
            '',
            `*Shares Included (${selectedDebtors.length} • ₹${totalSelectedAmount.toLocaleString('en-IN')}):*`,
            ...lines,
            '',
            includeAmountInQr
                ? '📸 *How to pay:* Save the QR card with your name above → open *PhonePe / GPay / Paytm* → *Scan from Gallery* (amount is pre-filled!).'
                : '📸 *How to pay:* Save the QR card above → open *PhonePe / GPay / Paytm* → *Scan from Gallery* & enter your share listed above.',
            origin ? `🔗 ${origin}` : '',
        ]
            .filter((line, idx, arr) => {
                if (line === '') return idx > 0 && arr[idx - 1] !== '';
                return true;
            })
            .join('\n');
    }, [
        activePerson,
        data.subtitle,
        includeAmountInQr,
        myUpiId,
        selectedDebtors,
        totalSelectedAmount,
    ]);

    const resolveSelectedBatchCards = async (): Promise<PreparedQrCard[]> => {
        if (
            preparedSignatureRef.current === currentBatchSignature &&
            selectedDebtors.every((d) => Boolean(preparedCardsRef.current[getDebtorKey(d.debtorName)]))
        ) {
            return selectedDebtors.map((d) => preparedCardsRef.current[getDebtorKey(d.debtorName)]);
        }

        const rendered = await Promise.all(selectedDebtors.map((d) => renderDebtorCard(d)));
        const nextMap = { ...preparedCardsRef.current };
        rendered.forEach((card) => {
            nextMap[card.key] = card;
        });
        preparedCardsRef.current = nextMap;
        preparedSignatureRef.current = currentBatchSignature;
        setPreparedCards(nextMap);
        return rendered;
    };

    const resolveSingleOpenCard = async (): Promise<PreparedQrCard> => {
        if (
            preparedOpenSigRef.current === currentOpenSignature &&
            preparedOpenCardRef.current
        ) {
            return preparedOpenCardRef.current;
        }
        const card = await renderOpenQrCard();
        preparedOpenCardRef.current = card;
        preparedOpenSigRef.current = currentOpenSignature;
        setIsOpenCardReady(true);
        return card;
    };

    const copyMessageNonBlocking = (text: string) => {
        if (!text || typeof navigator === 'undefined' || !navigator.clipboard) return;
        navigator.clipboard.writeText(text).catch(() => {});
    };

    const handleSharePrimary = async () => {
        if (!myUpiId || isSharingBatch) return;
        if (includeAmountInQr && selectedDebtors.length === 0) return;

        triggerHaptic('medium');
        setIsSharingBatch(true);
        copyMessageNonBlocking(whatsappMessage);

        try {
            if (!includeAmountInQr) {
                const openCard =
                    preparedOpenSigRef.current === currentOpenSignature &&
                    preparedOpenCardRef.current
                        ? preparedOpenCardRef.current
                        : await resolveSingleOpenCard();

                const outcome = await shareQrCardFiles({
                    files: [openCard.file],
                    title: `Pay ${activePerson} — Open Amount UPI QR`,
                    text: whatsappMessage,
                    fallbackItems: [{ blob: openCard.blob, fileName: openCard.fileName }],
                });

                if (outcome === 'shared') {
                    triggerHaptic('success');
                    showToast('Shared Open Amount QR! Breakdown also copied.', 'share');
                } else if (outcome === 'shared_files_only') {
                    triggerHaptic('success');
                    showToast(
                        'Shared Open QR card! Breakdown copied — paste in WhatsApp if needed.',
                        'content_copy'
                    );
                } else if (outcome === 'downloaded') {
                    triggerHaptic('success');
                    showToast(
                        'Saved Open QR PNG & copied breakdown message! Share both in WhatsApp.',
                        'download_done'
                    );
                }
                return;
            }

            const isCachedSync =
                preparedSignatureRef.current === currentBatchSignature &&
                selectedDebtors.every((d) =>
                    Boolean(preparedCardsRef.current[getDebtorKey(d.debtorName)])
                );
            const cards = isCachedSync
                ? selectedDebtors.map((d) => preparedCardsRef.current[getDebtorKey(d.debtorName)])
                : await resolveSelectedBatchCards();

            const outcome = await shareQrCardFiles({
                files: cards.map((c) => c.file),
                title: `Pay ${activePerson} — Settle-Up QRs`,
                text: whatsappMessage,
                fallbackItems: cards.map((c) => ({ blob: c.blob, fileName: c.fileName })),
            });

            if (outcome === 'shared') {
                triggerHaptic('success');
                showToast(
                    `Shared ${cards.length} ${cards.length === 1 ? 'QR card' : 'QR cards'}! Message also copied to clipboard.`,
                    'share'
                );
            } else if (outcome === 'shared_files_only') {
                triggerHaptic('success');
                showToast(
                    `Shared ${cards.length} QR cards! Settlement message copied — paste it in WhatsApp if needed.`,
                    'content_copy'
                );
            } else if (outcome === 'downloaded') {
                triggerHaptic('success');
                showToast(
                    `Saved ${cards.length} QR PNGs & copied WhatsApp message! Attach them in your group chat.`,
                    'download_done'
                );
            }
        } catch (err: unknown) {
            triggerHaptic('warning');
            showToast(`Could not prepare QR cards: ${String(err)}`, 'error');
        } finally {
            setIsSharingBatch(false);
        }
    };

    const handleDownloadPngs = async () => {
        if (!myUpiId || isDownloadingAll) return;
        if (includeAmountInQr && selectedDebtors.length === 0) return;

        triggerHaptic('medium');
        setIsDownloadingAll(true);
        copyMessageNonBlocking(whatsappMessage);
        try {
            if (!includeAmountInQr) {
                const openCard = await resolveSingleOpenCard();
                await downloadQrCards([{ blob: openCard.blob, fileName: openCard.fileName }]);
                triggerHaptic('success');
                showToast('Saved Open QR PNG & copied breakdown message!', 'download_done');
                return;
            }

            const cards = await resolveSelectedBatchCards();
            const items: QrCardShareItem[] = cards.map((c) => ({
                blob: c.blob,
                fileName: c.fileName,
            }));
            await downloadQrCards(items);
            triggerHaptic('success');
            showToast(
                `Saved ${cards.length} QR PNGs & copied summary message!`,
                'download_done'
            );
        } catch (err: unknown) {
            triggerHaptic('warning');
            showToast(`Could not save QR PNGs: ${String(err)}`, 'error');
        } finally {
            setIsDownloadingAll(false);
        }
    };

    const handleShareSingleDebtor = async (debtor: GroupCollectDebtorItem) => {
        const key = getDebtorKey(debtor.debtorName);
        if (!myUpiId || sharingSingleKey) return;
        triggerHaptic('light');
        setSharingSingleKey(key);
        const msg = `Hey ${debtor.debtorName}! Payment request for ₹${debtor.amount.toLocaleString('en-IN')}${debtor.description ? ` (${debtor.description})` : ''}.\n\nPay to ${activePerson} (UPI: ${myUpiId})\nSave this QR & scan from Gallery in PhonePe / GPay / Paytm.`;
        copyMessageNonBlocking(msg);

        try {
            const cached =
                preparedSignatureRef.current === currentBatchSignature
                    ? preparedCardsRef.current[key]
                    : undefined;
            const card = cached || (await renderDebtorCard(debtor));
            const outcome = await shareOrDownloadQrCard(
                card.blob,
                card.fileName,
                `Pay ${activePerson} — ${debtor.debtorName} (₹${debtor.amount.toLocaleString('en-IN')})`,
                msg
            );
            if (outcome === 'shared') {
                triggerHaptic('success');
                showToast(`Shared ${debtor.debtorName}'s QR card!`, 'share');
            } else if (outcome === 'downloaded') {
                triggerHaptic('success');
                showToast(`Saved ${debtor.debtorName}'s QR card!`, 'download_done');
            }
        } catch (err: unknown) {
            triggerHaptic('warning');
            showToast(`Failed to share QR: ${String(err)}`, 'error');
        } finally {
            setSharingSingleKey(null);
        }
    };

    const handleOpenWhatsAppText = () => {
        if (!whatsappMessage) return;
        triggerHaptic('light');
        window.open(
            `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`,
            '_blank',
            'noopener,noreferrer'
        );
    };

    const handleCopyMessage = async () => {
        if (!whatsappMessage) return;
        try {
            await navigator.clipboard.writeText(whatsappMessage);
            triggerHaptic('success');
            setCopiedMsg(true);
            showToast('Settlement breakdown copied!', 'content_copy');
            setTimeout(() => setCopiedMsg(false), 2000);
        } catch {
            triggerHaptic('warning');
        }
    };

    const handleCopyUpi = async () => {
        if (!myUpiId) return;
        try {
            await navigator.clipboard.writeText(myUpiId);
            triggerHaptic('success');
            setCopiedUpi(true);
            showToast(`Copied UPI ID: ${myUpiId}`, 'content_copy');
            setTimeout(() => setCopiedUpi(false), 2000);
        } catch {
            triggerHaptic('warning');
        }
    };

    const handleToggleDebtor = (name: string) => {
        const key = getDebtorKey(name);
        triggerHaptic('light');
        setSelectedKeys((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );
    };

    const handleToggleAllDebtors = () => {
        triggerHaptic('light');
        if (selectedKeys.length === data.debtors.length) {
            setSelectedKeys([]);
        } else {
            setSelectedKeys(data.debtors.map((d) => getDebtorKey(d.debtorName)));
        }
    };

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
            showToast('UPI ID saved! QR cards ready.', 'check_circle');
            setIsEditingUpi(false);
        } catch (err: unknown) {
            triggerHaptic('warning');
            showToast(`Failed to save UPI ID: ${String(err)}`, 'error');
        } finally {
            setIsSavingUpi(false);
        }
    };

    const handleScannedOwnQr = (parsed: ParsedUpiQr) => {
        setUpiInput(parsed.upiId);
        setShowScanner(false);
        showToast(`Loaded UPI ID: ${parsed.upiId}`, 'qr_code_scanner');
    };

    const readyCount = data.debtors.filter((d) =>
        Boolean(preparedCards[getDebtorKey(d.debtorName)])
    ).length;

    const isPrimaryDisabled =
        isSharingBatch || (includeAmountInQr && selectedDebtors.length === 0);
    const isDownloadDisabled =
        isDownloadingAll || (includeAmountInQr && selectedDebtors.length === 0);

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
                    <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
                        <div className="w-10 h-1 rounded-full bg-outline-variant/60" />
                    </div>

                    {/* Header */}
                    <div className="p-4 border-b border-outline-variant/20 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[22px]">
                                    qr_code_2
                                </span>
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-bold text-base text-on-surface truncate">
                                    {data.title}
                                </h3>
                                <p className="text-xs text-on-surface-variant truncate">
                                    {data.debtors.length}{' '}
                                    {data.debtors.length === 1 ? 'person owes' : 'people owe'} {activePerson}
                                    {data.subtitle ? ` • ${data.subtitle}` : ''}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer shrink-0"
                            aria-label="Close"
                        >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-4 overflow-y-auto space-y-4">
                        {!myUpiId || isEditingUpi ? (
                            <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/30 space-y-3">
                                <div className="flex items-start gap-2.5">
                                    <span className="material-symbols-outlined text-secondary text-[22px] mt-0.5 shrink-0">
                                        account_balance_wallet
                                    </span>
                                    <div>
                                        <h4 className="font-bold text-sm text-on-surface">
                                            {myUpiId ? 'Update your UPI ID' : 'Add your UPI ID to generate group QR cards'}
                                        </h4>
                                        <p className="text-xs text-on-surface-variant mt-0.5">
                                            Each friend gets a labeled QR code linked to this UPI ID and their exact owed amount.
                                        </p>
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
                                            className="h-11 px-3 rounded-xl bg-surface-container border border-outline-variant/40 text-primary hover:bg-primary/10 text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">
                                                qr_code_scanner
                                            </span>
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
                                                className="h-10 px-3 rounded-xl border border-outline-variant/40 text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={isSavingUpi}
                                            className="flex-1 h-10 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-xs hover:bg-primary/90 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">
                                                qr_code_2
                                            </span>
                                            <span>
                                                {isSavingUpi ? 'Saving...' : 'Save & Generate QR Cards'}
                                            </span>
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <>
                                {/* Receiving UPI Bar + Fixed vs Open Toggle */}
                                <div className="bg-surface-container-low rounded-2xl p-3 border border-outline-variant/25 space-y-2.5">
                                    <div className="flex items-center justify-between gap-2 text-xs">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="text-[10px] font-bold text-outline uppercase font-mono">
                                                UPI
                                            </span>
                                            <span className="font-mono font-semibold text-on-surface truncate">
                                                {myUpiId}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => void handleCopyUpi()}
                                                className="px-2 py-1 rounded-md text-primary font-semibold hover:bg-primary/10 transition-colors flex items-center gap-1 cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-[13px]">
                                                    {copiedUpi ? 'check' : 'content_copy'}
                                                </span>
                                                <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setUpiInput(myUpiId);
                                                    setIsEditingUpi(true);
                                                }}
                                                className="p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                                                title="Change UPI ID"
                                                aria-label="Change UPI ID"
                                            >
                                                <span className="material-symbols-outlined text-[15px]">
                                                    edit
                                                </span>
                                            </button>
                                        </div>
                                    </div>

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
                                            Fixed ₹ Per Debtor
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
                                            Open Amount QR
                                        </button>
                                    </div>
                                </div>

                                {includeAmountInQr ? (
                                    /* Fixed ₹ Per Debtor Mode: Personalized Multi-Card Preview & Picker */
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between px-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-on-surface">
                                                    Personalized QR Cards ({selectedDebtors.length}/{data.debtors.length})
                                                </span>
                                                {readyCount === data.debtors.length && (
                                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                                        Ready
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleToggleAllDebtors}
                                                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                                            >
                                                {selectedKeys.length === data.debtors.length
                                                    ? 'Clear All'
                                                    : 'Select All'}
                                            </button>
                                        </div>

                                        <div className="flex gap-2.5 overflow-x-auto pb-1 snap-x">
                                            {data.debtors.map((debtor) => {
                                                const key = getDebtorKey(debtor.debtorName);
                                                const isSelected = selectedKeySet.has(key);
                                                const qrUri = buildDebtorUri(debtor);
                                                const isSingleSharing = sharingSingleKey === key;

                                                return (
                                                    <div
                                                        key={key}
                                                        className={`w-[168px] shrink-0 snap-start rounded-2xl border p-2.5 flex flex-col justify-between gap-2 transition-colors ${
                                                            isSelected
                                                                ? 'bg-surface-container-lowest border-primary/50 ring-1 ring-primary/20 shadow-xs'
                                                                : 'bg-surface-container-low/60 border-outline-variant/30 opacity-65'
                                                        }`}
                                                    >
                                                        {/* Top: Debtor Name + Check Toggle */}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleDebtor(debtor.debtorName)}
                                                            className="flex items-center justify-between gap-1.5 text-left w-full cursor-pointer"
                                                        >
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                <Avatar name={debtor.debtorName} size="sm" />
                                                                <span className="text-xs font-bold text-on-surface truncate">
                                                                    {debtor.debtorName}
                                                                </span>
                                                            </div>
                                                            <span
                                                                className={`material-symbols-outlined text-[18px] shrink-0 ${
                                                                    isSelected
                                                                        ? 'text-primary'
                                                                        : 'text-outline-variant'
                                                                }`}
                                                            >
                                                                {isSelected
                                                                    ? 'check_circle'
                                                                    : 'radio_button_unchecked'}
                                                            </span>
                                                        </button>

                                                        {/* QR Preview */}
                                                        <div className="flex flex-col items-center bg-white rounded-xl p-2 border border-neutral-200">
                                                            <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 mb-1.5 truncate max-w-full">
                                                                For {debtor.debtorName}
                                                            </span>
                                                            {qrUri && <QRCode value={qrUri} size={96} />}
                                                            <span className="text-sm font-extrabold font-mono text-emerald-700 mt-1.5">
                                                                ₹{debtor.amount.toLocaleString('en-IN')}
                                                            </span>
                                                        </div>

                                                        {/* Split description + Quick Single Share */}
                                                        <div className="space-y-1.5">
                                                            <p
                                                                className="text-[10px] text-on-surface-variant truncate text-center"
                                                                title={debtor.description}
                                                            >
                                                                {debtor.description}
                                                            </p>
                                                            <button
                                                                type="button"
                                                                disabled={Boolean(sharingSingleKey)}
                                                                onClick={() => void handleShareSingleDebtor(debtor)}
                                                                className="w-full h-7 rounded-lg bg-surface-container hover:bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center gap-1 border border-outline-variant/25 transition-colors cursor-pointer disabled:opacity-50"
                                                            >
                                                                <span className="material-symbols-outlined text-[13px]">
                                                                    {isSingleSharing ? 'hourglass_top' : 'ios_share'}
                                                                </span>
                                                                <span>
                                                                    {isSingleSharing ? 'Sharing...' : 'Share 1'}
                                                                </span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    /* Open Amount QR Mode: Single Universal Downloadable & Shareable QR */
                                    <div className="space-y-3">
                                        <div className="bg-surface-container-low/70 border border-outline-variant/25 rounded-2xl p-4 flex flex-col items-center text-center space-y-2.5">
                                            <div className="bg-white rounded-2xl p-3 border border-neutral-200 shadow-xs flex flex-col items-center">
                                                <div className="flex items-center gap-1.5 mb-2">
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                        Open Amount QR
                                                    </span>
                                                    {isOpenCardReady && (
                                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                                            Ready
                                                        </span>
                                                    )}
                                                </div>
                                                {openQrUri && <QRCode value={openQrUri} size={172} />}
                                                <span className="text-xs font-bold text-emerald-800 mt-2">
                                                    Pay {activePerson} • Enter Your Share
                                                </span>
                                            </div>

                                            <p className="text-[11px] text-on-surface-variant max-w-[270px] leading-relaxed">
                                                Single universal QR card for everyone — each friend scans it and enters their own share from the message below.
                                            </p>
                                        </div>

                                        {/* Compact chips to control who is listed in the WhatsApp message */}
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between px-0.5">
                                                <span className="text-[11px] font-bold text-on-surface">
                                                    Included in Message ({selectedDebtors.length}/{data.debtors.length})
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={handleToggleAllDebtors}
                                                    className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                                                >
                                                    {selectedKeys.length === data.debtors.length
                                                        ? 'Clear All'
                                                        : 'Select All'}
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {data.debtors.map((debtor) => {
                                                    const key = getDebtorKey(debtor.debtorName);
                                                    const isSelected = selectedKeySet.has(key);
                                                    return (
                                                        <button
                                                            key={key}
                                                            type="button"
                                                            onClick={() => handleToggleDebtor(debtor.debtorName)}
                                                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1 transition-colors cursor-pointer ${
                                                                isSelected
                                                                    ? 'bg-primary/10 border-primary/40 text-primary'
                                                                    : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant opacity-70'
                                                            }`}
                                                        >
                                                            <span className="material-symbols-outlined text-[13px]">
                                                                {isSelected ? 'check' : 'add'}
                                                            </span>
                                                            <span>
                                                                {debtor.debtorName} · ₹{debtor.amount.toLocaleString('en-IN')}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Settlement Message Preview */}
                                {whatsappMessage && (
                                    <div className="bg-surface-container-low/80 border border-outline-variant/25 rounded-2xl p-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[11px] font-bold text-on-surface flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[#25D366] text-[15px]">
                                                    chat
                                                </span>
                                                <span>Accompanying WhatsApp Message</span>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => void handleCopyMessage()}
                                                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-[13px]">
                                                    {copiedMsg ? 'check' : 'content_copy'}
                                                </span>
                                                <span>{copiedMsg ? 'Copied' : 'Copy Msg'}</span>
                                            </button>
                                        </div>
                                        <pre className="text-[11px] leading-relaxed text-on-surface-variant whitespace-pre-wrap font-sans max-h-28 overflow-y-auto bg-surface-container-lowest rounded-xl p-2.5 border border-outline-variant/20">
                                            {whatsappMessage}
                                        </pre>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer Actions */}
                    {myUpiId && !isEditingUpi && (
                        <div className="p-4 pb-safe border-t border-outline-variant/20 bg-surface-container-lowest space-y-2">
                            <button
                                type="button"
                                disabled={isPrimaryDisabled}
                                onClick={() => void handleSharePrimary()}
                                className="w-full h-12 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined text-[20px]">
                                    {isSharingBatch ? 'hourglass_top' : 'ios_share'}
                                </span>
                                <span>
                                    {isSharingBatch
                                        ? 'Preparing QR...'
                                        : !includeAmountInQr
                                          ? 'Share Open QR Card to WhatsApp'
                                          : selectedDebtors.length === 0
                                            ? 'Select at least 1 debtor'
                                            : `Share ${selectedDebtors.length} ${
                                                  selectedDebtors.length === 1 ? 'QR Card' : 'QR Cards'
                                              } to WhatsApp`}
                                </span>
                            </button>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    disabled={isDownloadDisabled}
                                    onClick={() => void handleDownloadPngs()}
                                    className="h-9 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined text-[16px] text-primary">
                                        download
                                    </span>
                                    <span>
                                        {isDownloadingAll
                                            ? 'Saving...'
                                            : includeAmountInQr
                                              ? 'Save All PNGs'
                                              : 'Save QR PNG'}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    disabled={!whatsappMessage}
                                    onClick={handleOpenWhatsAppText}
                                    className="h-9 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined text-[16px] text-[#25D366]">
                                        chat
                                    </span>
                                    <span>Text Only (wa.me)</span>
                                </button>
                            </div>

                            <p className="text-[10px] text-on-surface-variant text-center leading-relaxed">
                                {includeAmountInQr
                                    ? 'Each PNG shows the debtor\u2019s name & share. Message auto-copies to clipboard if iOS WhatsApp asks for a caption.'
                                    : '1 universal QR image + breakdown message (auto-copied to clipboard for iOS WhatsApp).'}
                            </p>
                        </div>
                    )}
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

export const GroupCollectQrModal: React.FC<GroupCollectQrModalProps> = ({
    isOpen,
    onClose,
    data,
}) => {
    if (!isOpen || !data || data.debtors.length === 0) return null;

    const modalKey = `${data.title}-${data.debtors.map((d) => `${d.debtorName}:${d.amount}`).join('|')}`;

    return (
        <GroupCollectQrContent
            key={modalKey}
            onClose={onClose}
            data={data}
        />
    );
};

export default GroupCollectQrModal;
