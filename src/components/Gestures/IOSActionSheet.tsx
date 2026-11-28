import React, { useState, useRef, useEffect } from 'react';
import { AppIcon } from '../Icon/AppIcon';
import { triggerHaptic } from '../../utils/haptics';
import { getCategoryMeta } from '../../utils/formatters';

export interface ActionSheetItemData {
    id: string;
    description: string;
    amount: number;
    category?: string;
    timestamp?: string;
    paidBy?: string;
    isSplitShare?: boolean;
    totalBill?: number;
    canDelete?: boolean;
}

export interface IOSActionSheetProps {
    isOpen: boolean;
    onClose: () => void;
    item: ActionSheetItemData | null;
    onEdit?: () => void;
    onDelete?: () => void;
    onCopySuccess?: (message: string) => void;
}

export const IOSActionSheet: React.FC<IOSActionSheetProps> = ({
    isOpen,
    onClose,
    item,
    onEdit,
    onDelete,
    onCopySuccess,
}) => {
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startYRef = useRef(0);
    const isDraggingRef = useRef(false);

    useEffect(() => {
        if (!isOpen) {
            setDragY(0);
            setIsDragging(false);
        }
    }, [isOpen]);

    if (!isOpen || !item) return null;

    const catMeta = getCategoryMeta(item.category || 'General');

    // Drag down to dismiss gesture with spring damping
    const handleTouchStart = (e: React.TouchEvent) => {
        startYRef.current = e.touches[0].clientY;
        isDraggingRef.current = true;
        setIsDragging(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDraggingRef.current) return;
        const currentY = e.touches[0].clientY;
        const diffY = currentY - startYRef.current;

        if (diffY > 0) {
            if (e.cancelable) e.preventDefault();
            // Elastic damping as drag distance increases
            const damped = diffY < 80 ? diffY : 80 + (diffY - 80) * 0.55;
            setDragY(damped);
        } else {
            // High upward resistance
            setDragY(diffY * 0.15);
        }
    };

    const handleTouchEnd = () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        setIsDragging(false);

        if (dragY > 80) {
            triggerHaptic('light');
            onClose();
        } else {
            setDragY(0);
        }
    };

    const handleCopyDescription = async () => {
        try {
            await navigator.clipboard.writeText(item.description);
            triggerHaptic('success');
            onCopySuccess?.(`Copied: "${item.description}"`);
            onClose();
        } catch {
            triggerHaptic('warning');
        }
    };

    const handleCopyAmount = async () => {
        try {
            await navigator.clipboard.writeText(`₹${item.amount}`);
            triggerHaptic('success');
            onCopySuccess?.(`Copied amount: ₹${item.amount.toLocaleString('en-IN')}`);
            onClose();
        } catch {
            triggerHaptic('warning');
        }
    };

    const handleShare = async () => {
        const text = `${item.description} • ₹${item.amount.toLocaleString('en-IN')} (${item.category || 'General'})`;
        try {
            if (typeof navigator.share === 'function') {
                await navigator.share({
                    title: 'SplitNest Transaction',
                    text,
                });
                triggerHaptic('light');
            } else {
                await navigator.clipboard.writeText(text);
                triggerHaptic('success');
                onCopySuccess?.('Transaction summary copied to clipboard');
            }
            onClose();
        } catch {
            // User cancelled share
        }
    };

    const handleDelete = () => {
        triggerHaptic('medium');
        onClose();
        if (onDelete) {
            onDelete();
        }
    };

    return (
        <div
            className="fixed inset-0 z-70 bg-black/50 backdrop-blur-sm flex items-end justify-center p-0 sm:p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onClick={(e) => e.stopPropagation()}
                style={{
                    transform: `translate3d(0, ${Math.max(0, dragY)}px, 0)`,
                    transition: isDragging ? 'none' : 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                className="w-full max-w-sm mx-auto px-4 pb-6 pb-safe space-y-2.5 animate-in slide-in-from-bottom duration-250 select-none"
            >
                {/* Pull down indicator handle */}
                <div className="w-10 h-1.5 rounded-full bg-white/40 hover:bg-white/60 mx-auto mb-1.5 shadow-2xs transition-colors" />

                {/* Main Action Group Card */}
                <div className="bg-surface-container-lowest/98 backdrop-blur-2xl border border-outline-variant/35 rounded-2xl overflow-hidden shadow-2xl divide-y divide-outline-variant/15">
                    {/* Header info */}
                    <div className="p-4 flex items-center gap-3.5 bg-surface-container-low/40">
                        <div
                            className={`w-11 h-11 rounded-xl ${catMeta.bgClass} flex items-center justify-center shrink-0 shadow-2xs`}
                        >
                            <AppIcon name={catMeta.icon} className={`text-[22px] ${catMeta.textClass}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-sm text-on-surface truncate leading-tight">
                                {item.description}
                            </h3>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="font-mono font-bold text-sm text-primary shrink-0">
                                    ₹{item.amount.toLocaleString('en-IN')}
                                </span>
                                {item.category && (
                                    <span className="text-[10px] font-semibold text-on-surface-variant px-1.5 py-0.5 rounded-md bg-surface-container shrink-0">
                                        {item.category}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action 1: Copy Description */}
                    <button
                        type="button"
                        onClick={handleCopyDescription}
                        className="w-full h-12 px-4 flex items-center justify-between text-xs font-semibold text-on-surface hover:bg-surface-container/80 active:bg-surface-container-high active:scale-[0.99] transition-all cursor-pointer"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <AppIcon name="content_copy" className="text-[16px]" />
                            </div>
                            <span>Copy Description</span>
                        </div>
                        <AppIcon name="chevron_right" className="text-[16px] text-on-surface-variant/40" />
                    </button>

                    {/* Action 2: Copy Amount */}
                    <button
                        type="button"
                        onClick={handleCopyAmount}
                        className="w-full h-12 px-4 flex items-center justify-between text-xs font-semibold text-on-surface hover:bg-surface-container/80 active:bg-surface-container-high active:scale-[0.99] transition-all cursor-pointer"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <AppIcon name="payments" className="text-[16px]" />
                            </div>
                            <span>Copy Amount</span>
                        </div>
                        <AppIcon name="chevron_right" className="text-[16px] text-on-surface-variant/40" />
                    </button>

                    {/* Action 3: Share Details */}
                    <button
                        type="button"
                        onClick={handleShare}
                        className="w-full h-12 px-4 flex items-center justify-between text-xs font-semibold text-on-surface hover:bg-surface-container/80 active:bg-surface-container-high active:scale-[0.99] transition-all cursor-pointer"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <AppIcon name="ios_share" className="text-[16px]" />
                            </div>
                            <span>Share Transaction Details</span>
                        </div>
                        <AppIcon name="chevron_right" className="text-[16px] text-on-surface-variant/40" />
                    </button>

                    {/* Action 4: Edit Transaction */}
                    {item.canDelete && onEdit && (
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic('light');
                                onClose();
                                onEdit();
                            }}
                            className="w-full h-12 px-4 flex items-center justify-between text-xs font-semibold text-on-surface hover:bg-surface-container/80 active:bg-surface-container-high active:scale-[0.99] transition-all cursor-pointer"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <AppIcon name="edit" className="text-[16px]" />
                                </div>
                                <span>Edit Transaction</span>
                            </div>
                            <AppIcon name="chevron_right" className="text-[16px] text-on-surface-variant/40" />
                        </button>
                    )}

                    {/* Action 5: Delete Transaction (Red destructive) */}
                    {item.canDelete && (
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="w-full h-12 px-4 flex items-center justify-between text-xs font-bold text-error hover:bg-error/10 active:bg-error/15 active:scale-[0.99] transition-all cursor-pointer"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-error/15 text-error flex items-center justify-center shrink-0">
                                    <AppIcon name="delete" className="text-[16px]" />
                                </div>
                                <span>Delete Transaction</span>
                            </div>
                            <AppIcon name="chevron_right" className="text-[16px] text-error/40" />
                        </button>
                    )}
                </div>

                {/* Cancel Button (Separate Pill) */}
                <button
                    type="button"
                    onClick={() => {
                        triggerHaptic('light');
                        onClose();
                    }}
                    className="w-full h-12 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 text-sm font-bold text-primary flex items-center justify-center shadow-lg active:scale-[0.98] transition-transform cursor-pointer"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default IOSActionSheet;
