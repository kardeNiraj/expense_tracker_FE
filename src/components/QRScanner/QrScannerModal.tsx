import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { parseUpiQrPayload, type ParsedUpiQr } from '../../utils/qr';
import { triggerHaptic } from '../../utils/haptics';
import { AppIcon } from '../Icon/AppIcon';

export interface QrScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScanUpi: (parsed: ParsedUpiQr) => void;
    title?: string;
    subtitle?: string;
}

interface QrScannerContentProps {
    onClose: () => void;
    onScanUpi: (parsed: ParsedUpiQr) => void;
    title: string;
    subtitle: string;
}

interface MediaTrackCapabilitiesWithTorch extends MediaTrackCapabilities {
    torch?: boolean;
}

interface MediaTrackConstraintSetWithTorch extends MediaTrackConstraintSet {
    torch?: boolean;
}

const FRAME_SCAN_INTERVAL_MS = 120;
const MAX_VIDEO_SCAN_DIM = 640;
const MAX_IMAGE_SCAN_DIM = 1200;

function drawImageToCanvas(
    source: CanvasImageSource,
    srcWidth: number,
    srcHeight: number,
    maxDim: number,
    canvas: HTMLCanvasElement
): { width: number; height: number } | null {
    if (!srcWidth || !srcHeight) return null;
    const scale = Math.min(1, maxDim / Math.max(srcWidth, srcHeight));
    const width = Math.max(1, Math.round(srcWidth * scale));
    const height = Math.max(1, Math.round(srcHeight * scale));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, width, height);
    return { width, height };
}

async function decodeFileToQrText(file: File): Promise<string | null> {
    const canvas = document.createElement('canvas');
    let bitmap: ImageBitmap | null = null;

    if (typeof createImageBitmap === 'function') {
        try {
            bitmap = await createImageBitmap(file);
            const dims = drawImageToCanvas(
                bitmap,
                bitmap.width,
                bitmap.height,
                MAX_IMAGE_SCAN_DIM,
                canvas
            );
            if (!dims) return null;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return null;
            const imgData = ctx.getImageData(0, 0, dims.width, dims.height);
            const decoded = jsQR(imgData.data, dims.width, dims.height, {
                inversionAttempts: 'attemptBoth',
            });
            return decoded?.data || null;
        } finally {
            bitmap?.close();
        }
    }

    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('Could not read image'));
            el.src = url;
        });
        const dims = drawImageToCanvas(
            img,
            img.naturalWidth,
            img.naturalHeight,
            MAX_IMAGE_SCAN_DIM,
            canvas
        );
        if (!dims) return null;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        const imgData = ctx.getImageData(0, 0, dims.width, dims.height);
        const decoded = jsQR(imgData.data, dims.width, dims.height, {
            inversionAttempts: 'attemptBoth',
        });
        return decoded?.data || null;
    } finally {
        URL.revokeObjectURL(url);
    }
}

const QrScannerContent: React.FC<QrScannerContentProps> = ({
    onClose,
    onScanUpi,
    title,
    subtitle,
}) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const lastScanTimeRef = useRef<number>(0);
    const handledRef = useRef<boolean>(false);

    const hasMediaDevices =
        typeof navigator !== 'undefined' &&
        Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    const [cameraStatus, setCameraStatus] = useState<'starting' | 'active' | 'error'>(
        hasMediaDevices ? 'starting' : 'error'
    );
    const [cameraError, setCameraError] = useState<string | null>(
        hasMediaDevices
            ? null
            : 'Camera access requires HTTPS or a supported browser. Upload a QR photo or paste a UPI ID below.'
    );
    const [scanWarning, setScanWarning] = useState<string | null>(null);
    const [torchSupported, setTorchSupported] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [isDecodingPhoto, setIsDecodingPhoto] = useState(false);
    const [manualInput, setManualInput] = useState('');
    const [showManualFallback, setShowManualFallback] = useState(false);

    const stopCamera = useCallback(() => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    const handleDecodedRawText = useCallback(
        (rawText: string) => {
            if (handledRef.current) return;
            const parsed = parseUpiQrPayload(rawText);
            if (!parsed) {
                triggerHaptic('warning');
                setScanWarning(
                    'That QR code does not contain a UPI payment ID. Try a GPay, PhonePe, Paytm, or SplitNest QR.'
                );
                return;
            }
            handledRef.current = true;
            stopCamera();
            triggerHaptic('success');
            onScanUpi(parsed);
        },
        [onScanUpi, stopCamera]
    );

    useEffect(() => {
        if (!hasMediaDevices) return;

        let cancelled = false;
        const canvas = document.createElement('canvas');

        const scanFrame = (timestamp: number) => {
            if (cancelled || handledRef.current) return;
            const video = videoRef.current;

            if (
                video &&
                video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA &&
                video.videoWidth > 0 &&
                timestamp - lastScanTimeRef.current >= FRAME_SCAN_INTERVAL_MS
            ) {
                lastScanTimeRef.current = timestamp;
                const dims = drawImageToCanvas(
                    video,
                    video.videoWidth,
                    video.videoHeight,
                    MAX_VIDEO_SCAN_DIM,
                    canvas
                );
                if (dims) {
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    if (ctx) {
                        const imageData = ctx.getImageData(0, 0, dims.width, dims.height);
                        const result = jsQR(imageData.data, dims.width, dims.height, {
                            inversionAttempts: 'attemptBoth',
                        });
                        if (result?.data) {
                            handleDecodedRawText(result.data);
                            if (handledRef.current) return;
                        }
                    }
                }
            }

            rafRef.current = requestAnimationFrame(scanFrame);
        };

        void navigator.mediaDevices
            .getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            })
            .then(async (stream) => {
                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }
                streamRef.current = stream;

                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
                    const caps = videoTrack.getCapabilities() as MediaTrackCapabilitiesWithTorch;
                    if (caps.torch) {
                        setTorchSupported(true);
                    }
                }

                const video = videoRef.current;
                if (video) {
                    video.srcObject = stream;
                    await video.play().catch(() => {});
                }

                if (!cancelled) {
                    setCameraStatus('active');
                    rafRef.current = requestAnimationFrame(scanFrame);
                }
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : String(err);
                const isDenied =
                    message.toLowerCase().includes('permission') ||
                    message.toLowerCase().includes('denied') ||
                    message.toLowerCase().includes('notallowed');

                setCameraStatus('error');
                setCameraError(
                    isDenied
                        ? 'Camera permission was blocked. Allow camera access or upload a QR photo from your gallery.'
                        : 'Could not start rear camera. You can upload a QR screenshot/photo below.'
                );
            });

        return () => {
            cancelled = true;
            stopCamera();
        };
    }, [handleDecodedRawText, hasMediaDevices, stopCamera]);

    const handleToggleTorch = async () => {
        const videoTrack = streamRef.current?.getVideoTracks()[0];
        if (!videoTrack) return;
        const nextTorch = !torchOn;
        try {
            const constraint: MediaTrackConstraintSetWithTorch = { torch: nextTorch };
            await videoTrack.applyConstraints({
                advanced: [constraint],
            });
            setTorchOn(nextTorch);
            triggerHaptic('light');
        } catch {
            setTorchSupported(false);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        setScanWarning(null);
        setIsDecodingPhoto(true);
        try {
            const rawText = await decodeFileToQrText(file);
            if (!rawText) {
                triggerHaptic('warning');
                setScanWarning(
                    'No QR code was detected in that photo. Make sure the QR code is sharp and well-lit.'
                );
                return;
            }
            handleDecodedRawText(rawText);
        } catch {
            triggerHaptic('warning');
            setScanWarning('Could not read that image. Please try another QR screenshot.');
        } finally {
            setIsDecodingPhoto(false);
        }
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setScanWarning(null);
        const parsed = parseUpiQrPayload(manualInput);
        if (!parsed) {
            triggerHaptic('warning');
            setScanWarning('Enter a valid UPI ID (e.g. name@okhdfcbank) or upi://pay link.');
            return;
        }
        handledRef.current = true;
        stopCamera();
        triggerHaptic('success');
        onScanUpi(parsed);
    };

    return (
        <div className="fixed inset-0 z-70 flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

            <div className="relative z-10 w-full max-w-sm max-h-[92vh] overflow-y-auto bg-surface-container-lowest border-t sm:border border-outline-variant/30 rounded-t-3xl sm:rounded-3xl p-5 pb-safe shadow-2xl space-y-4 text-on-surface animate-in slide-in-from-bottom duration-200">
                <div className="w-12 h-1 bg-outline-variant/40 rounded-full mx-auto -mt-1 mb-1 sm:hidden" />

                {/* Header */}
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-outline-variant/20">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <AppIcon name="qr_code_scanner" className="text-[20px]" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-sm text-on-surface truncate">{title}</h3>
                            <p className="text-[11px] text-on-surface-variant truncate">{subtitle}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer shrink-0"
                        aria-label="Close scanner"
                    >
                        <AppIcon name="close" className="text-[20px]" />
                    </button>
                </div>

                {/* Camera Viewfinder */}
                {cameraStatus !== 'error' ? (
                    <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black border border-outline-variant/30 shadow-inner">
                        <video
                            ref={videoRef}
                            playsInline
                            muted
                            autoPlay
                            className="w-full h-full object-cover"
                        />

                        {/* Target Frame Overlay */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-52 h-52 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.38)] relative">
                                <span className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                                <span className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                                <span className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                                <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-xl" />
                            </div>
                        </div>

                        {cameraStatus === 'starting' && (
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white text-xs gap-2">
                                <AppIcon name="photo_camera" className="text-[28px] animate-pulse" />
                                <span>Starting rear camera...</span>
                            </div>
                        )}

                        {torchSupported && cameraStatus === 'active' && (
                            <button
                                type="button"
                                onClick={() => void handleToggleTorch()}
                                className={`absolute bottom-3 right-3 h-9 px-3 rounded-full text-xs font-semibold flex items-center gap-1 shadow-md cursor-pointer transition-colors ${
                                    torchOn
                                        ? 'bg-primary text-on-primary'
                                        : 'bg-black/65 text-white hover:bg-black/80'
                                }`}
                                aria-label={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
                            >
                                <AppIcon name={torchOn ? 'flashlight_off' : 'flashlight_on'} className="text-[16px]" />
                                <span>{torchOn ? 'Torch On' : 'Torch'}</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center space-y-2.5">
                        <div className="w-11 h-11 rounded-2xl bg-tertiary/15 text-tertiary flex items-center justify-center mx-auto">
                            <AppIcon name="no_photography" className="text-[24px]" />
                        </div>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                            {cameraError}
                        </p>
                    </div>
                )}

                {scanWarning && (
                    <div className="p-3 rounded-xl bg-tertiary-container/35 border border-tertiary/30 text-xs text-on-tertiary-container flex items-start gap-2">
                        <AppIcon name="warning" className="text-[16px] text-tertiary shrink-0 mt-0.5" />
                        <span className="flex-1">{scanWarning}</span>
                    </div>
                )}

                {/* Gallery / Screenshot QR Picker */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleFileSelect(e)}
                    className="hidden"
                />

                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        disabled={isDecodingPhoto}
                        onClick={() => fileInputRef.current?.click()}
                        className="h-11 px-3 rounded-xl bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs hover:bg-primary/90 active:scale-[0.98] transition-colors cursor-pointer disabled:opacity-50"
                    >
                        <AppIcon name={isDecodingPhoto ? 'hourglass_top' : 'add_photo_alternate'} className="text-[18px]" />
                        <span>{isDecodingPhoto ? 'Reading...' : 'Upload QR Photo'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowManualFallback((prev) => !prev)}
                        className="h-11 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                        <AppIcon name="edit" className="text-[17px] text-primary" />
                        <span>Paste UPI</span>
                    </button>
                </div>

                {showManualFallback && (
                    <form onSubmit={handleManualSubmit} className="space-y-2 pt-1">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={manualInput}
                                onChange={(e) => setManualInput(e.target.value)}
                                placeholder="Paste upi://pay?... or name@bank"
                                className="flex-1 h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                                autoCapitalize="none"
                                autoCorrect="off"
                            />
                            <button
                                type="submit"
                                className="h-10 px-3.5 rounded-xl bg-primary text-on-primary text-xs font-bold cursor-pointer"
                            >
                                Use
                            </button>
                        </div>
                    </form>
                )}

                <p className="text-[11px] text-on-surface-variant text-center">
                    Point at a friend&apos;s PhonePe, GPay, Paytm, or SplitNest QR — or upload a saved screenshot.
                </p>
            </div>
        </div>
    );
};

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
    isOpen,
    onClose,
    onScanUpi,
    title = 'Scan UPI QR Code',
    subtitle = 'Camera or screenshot upload',
}) => {
    if (!isOpen) return null;

    return (
        <QrScannerContent
            onClose={onClose}
            onScanUpi={onScanUpi}
            title={title}
            subtitle={subtitle}
        />
    );
};

export default QrScannerModal;
