import React, { useState, useRef, useEffect, useCallback } from 'react';
import { triggerHaptic } from '../../utils/haptics';
import { AppIcon } from '../Icon/AppIcon';

// Global singleton listener to close any other open swipeable rows
const closeListeners = new Set<(id: string) => void>();

export interface SwipeableRowProps {
    id: string;
    children: React.ReactNode;
    onDelete?: () => void;
    canDelete?: boolean;
    onLongPress?: () => void;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
}

const ACTION_WIDTH = 76; // px to reveal delete button
const FULL_SWIPE_THRESHOLD = 175; // px to trigger instant full-swipe delete
const LONG_PRESS_DURATION = 420; // ms to trigger long press action sheet

export const SwipeableRow: React.FC<SwipeableRowProps> = ({
    id,
    children,
    onDelete,
    canDelete = true,
    onLongPress,
    onClick,
    disabled = false,
    className = '',
}) => {
    const [offsetX, setOffsetX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isLongPressing, setIsLongPressing] = useState(false);
    const [isFullSwipeArmed, setIsFullSwipeArmed] = useState(false);

    const startXRef = useRef(0);
    const startYRef = useRef(0);
    const currentOffsetRef = useRef(0);
    const isHorizontalSwipeRef = useRef<boolean | null>(null);
    const isDraggingRef = useRef(false);
    const justDraggedRef = useRef(false);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fullSwipeFiredRef = useRef(false);
    const rowRef = useRef<HTMLDivElement>(null);

    // Register with global listener to close when another row opens
    useEffect(() => {
        const handleCloseOthers = (openedId: string) => {
            if (openedId !== id && currentOffsetRef.current !== 0) {
                setOffsetX(0);
                setIsOpen(false);
                currentOffsetRef.current = 0;
            }
        };

        closeListeners.add(handleCloseOthers);
        return () => {
            closeListeners.delete(handleCloseOthers);
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
            }
        };
    }, [id]);

    const notifyOpened = useCallback(() => {
        closeListeners.forEach((listener) => listener(id));
    }, [id]);

    const clearLongPress = useCallback(() => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        setIsLongPressing(false);
    }, []);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (disabled) return;
        const touch = e.touches[0];
        if (!touch) return;

        startXRef.current = touch.clientX;
        startYRef.current = touch.clientY;
        isHorizontalSwipeRef.current = null;
        isDraggingRef.current = true;
        fullSwipeFiredRef.current = false;
        setIsDragging(true);

        // Start long-press timer if onLongPress provided
        if (onLongPress && currentOffsetRef.current === 0) {
            setIsLongPressing(true);
            longPressTimerRef.current = setTimeout(() => {
                triggerHaptic('medium');
                setIsLongPressing(false);
                onLongPress();
            }, LONG_PRESS_DURATION);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDraggingRef.current || disabled) return;
        const touch = e.touches[0];
        if (!touch) return;

        const diffX = touch.clientX - startXRef.current;
        const diffY = touch.clientY - startYRef.current;

        // Cancel long-press if finger moved beyond 6px
        if (Math.abs(diffX) > 6 || Math.abs(diffY) > 6) {
            clearLongPress();
        }

        // Determine gesture axis if not yet locked
        if (isHorizontalSwipeRef.current === null) {
            if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 6) {
                isHorizontalSwipeRef.current = false; // vertical scroll, ignore
                isDraggingRef.current = false;
                setIsDragging(false);
                return;
            }
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 6) {
                isHorizontalSwipeRef.current = true; // horizontal swipe locked
                notifyOpened();
            }
        }

        if (isHorizontalSwipeRef.current) {
            if (!canDelete) {
                // If deletion not permitted, provide slight rubber-band resistance
                const bounded = diffX * 0.15;
                setOffsetX(bounded);
                currentOffsetRef.current = bounded;
                return;
            }

            // Left swipe (negative diffX) reveals delete button
            const baseOffset = isOpen ? -ACTION_WIDTH : 0;
            const raw = baseOffset + diffX;

            let computed: number;
            if (raw < 0) {
                const abs = Math.abs(raw);
                if (abs <= ACTION_WIDTH) {
                    computed = -abs;
                } else {
                    // Damped resistance beyond action width
                    computed = -(ACTION_WIDTH + (abs - ACTION_WIDTH) * 0.45);
                }

                // Check full-swipe threshold
                const isArmed = Math.abs(computed) >= FULL_SWIPE_THRESHOLD;
                if (isArmed && !fullSwipeFiredRef.current) {
                    fullSwipeFiredRef.current = true;
                    triggerHaptic('medium');
                    setIsFullSwipeArmed(true);
                } else if (!isArmed && fullSwipeFiredRef.current) {
                    fullSwipeFiredRef.current = false;
                    setIsFullSwipeArmed(false);
                }
            } else {
                // Rubber band on right swipe
                computed = Math.min(25, raw * 0.2);
            }

            setOffsetX(computed);
            currentOffsetRef.current = computed;
        }
    };

    const handleTouchEnd = () => {
        clearLongPress();
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        setIsDragging(false);

        const current = currentOffsetRef.current;

        // 1. Full swipe trigger
        if (canDelete && Math.abs(current) >= FULL_SWIPE_THRESHOLD && onDelete) {
            triggerHaptic('success');
            setOffsetX(-window.innerWidth);
            currentOffsetRef.current = -window.innerWidth;
            setTimeout(() => {
                onDelete();
                setOffsetX(0);
                currentOffsetRef.current = 0;
                setIsOpen(false);
                setIsFullSwipeArmed(false);
            }, 200);
            return;
        }

        setIsFullSwipeArmed(false);

        if (Math.abs(current) > 10) {
            justDraggedRef.current = true;
            setTimeout(() => {
                justDraggedRef.current = false;
            }, 160);
        }

        // 2. Snap open or closed
        if (canDelete && current <= -ACTION_WIDTH * 0.45) {
            // Snap open
            setOffsetX(-ACTION_WIDTH);
            currentOffsetRef.current = -ACTION_WIDTH;
            setIsOpen(true);
            triggerHaptic('light');
        } else {
            // Snap closed
            setOffsetX(0);
            currentOffsetRef.current = 0;
            setIsOpen(false);
        }
    };

    const handleCardClick = (e: React.MouseEvent) => {
        if (justDraggedRef.current) {
            justDraggedRef.current = false;
            return;
        }
        if (isOpen) {
            e.stopPropagation();
            setOffsetX(0);
            currentOffsetRef.current = 0;
            setIsOpen(false);
            triggerHaptic('selection');
            return;
        }
        if (onClick) {
            onClick();
        }
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        triggerHaptic('medium');
        if (onDelete) {
            onDelete();
        }
        setOffsetX(0);
        currentOffsetRef.current = 0;
        setIsOpen(false);
    };

    return (
        <div
            ref={rowRef}
            className={`relative overflow-hidden rounded-2xl select-none ${className}`}
        >
            {/* Background Action Button (iOS Red Delete) */}
            {canDelete && (
                <div
                    className={`absolute inset-y-0 right-0 z-0 flex items-stretch transition-colors duration-200 ${
                        isFullSwipeArmed ? 'bg-error-container' : 'bg-error'
                    }`}
                    style={{
                        width: isFullSwipeArmed ? '100%' : `${ACTION_WIDTH}px`,
                    }}
                >
                    <button
                        type="button"
                        onClick={handleDeleteClick}
                        aria-label="Delete item"
                        className="w-full h-full flex flex-col items-center justify-center text-on-error px-3 font-semibold text-[11px] gap-1 cursor-pointer active:opacity-85 transition-opacity"
                    >
                        <AppIcon
                            name={isFullSwipeArmed ? 'delete_forever' : 'delete'}
                            className={`transition-transform duration-150 ${
                                isFullSwipeArmed ? 'scale-125 text-[24px]' : 'text-[20px]'
                            }`}
                        />
                        <span className="leading-tight">
                            {isFullSwipeArmed ? 'Release' : 'Delete'}
                        </span>
                    </button>
                </div>
            )}

            {/* Foreground Card Content */}
            <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onClick={handleCardClick}
                style={{
                    transform: `translate3d(${offsetX}px, 0, 0)`,
                    transition: isDragging
                        ? 'none'
                        : 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                className={`relative z-10 w-full will-change-transform ${
                    isLongPressing
                        ? 'scale-[0.98] transition-transform duration-200'
                        : ''
                }`}
            >
                {children}
            </div>
        </div>
    );
};

export default SwipeableRow;
