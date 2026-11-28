import React, { useState, useRef, useEffect, useCallback } from 'react';
import { triggerHaptic } from '../../utils/haptics';
import { AppIcon } from '../Icon/AppIcon';
import { shouldAnimateCard } from '../../utils/animationSanity';

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
    index?: number;
    animateEnter?: boolean;
}

const ACTION_WIDTH = 76; // px to reveal delete button
const FULL_SWIPE_THRESHOLD = 165; // px to trigger instant full-swipe delete
const SLOP_THRESHOLD = 7; // px to establish horizontal swipe intent
const LONG_PRESS_DURATION = 400; // ms to trigger long press action sheet

interface MorphStyles {
    containerWidth: number;
    buttonWidth: string;
    buttonHeight: string;
    borderRadius: string;
    marginRight: string;
    iconScale: number;
    iconOpacity: number;
    labelOpacity: number;
    isSpherical: boolean;
}

const getDeleteMorphStyles = (
    dist: number,
    actionWidth: number,
    isFullSwipe: boolean,
    isCollapsing: boolean
): MorphStyles => {
    if (dist <= 0 || isCollapsing) {
        return {
            containerWidth: 0,
            buttonWidth: '0px',
            buttonHeight: '0px',
            borderRadius: '9999px',
            marginRight: '0px',
            iconScale: 0.5,
            iconOpacity: 0,
            labelOpacity: 0,
            isSpherical: true,
        };
    }

    if (isFullSwipe) {
        return {
            containerWidth: dist,
            buttonWidth: '100%',
            buttonHeight: '100%',
            borderRadius: '16px',
            marginRight: '0px',
            iconScale: 1.25,
            iconOpacity: 1,
            labelOpacity: 1,
            isSpherical: false,
        };
    }

    if (dist < 46) {
        // Pure spherical circle / bubble phase: grows from 16px to 42px
        const circleSize = Math.min(42, Math.max(16, dist - 4));
        const iconProgress = Math.min(1, Math.max(0.4, (dist - 8) / 36));
        return {
            containerWidth: dist,
            buttonWidth: `${circleSize}px`,
            buttonHeight: `${circleSize}px`,
            borderRadius: '9999px',
            marginRight: `${Math.max(2, (dist - circleSize) / 2)}px`,
            iconScale: Math.min(1, Math.max(0.65, iconProgress)),
            iconOpacity: iconProgress,
            labelOpacity: 0,
            isSpherical: true,
        };
    }

    if (dist < actionWidth) {
        // Morphing phase from spherical circle to card rounded rectangle
        const t = (dist - 46) / (actionWidth - 46); // 0 to 1
        const rad = (1 - t) * 26 + t * 16; // 26px -> 16px (matches rounded-2xl)
        const insetY = (1 - t) * 7; // 7px inset -> 0px inset (flush card height)
        const insetR = (1 - t) * 5; // 5px margin -> 0px margin
        return {
            containerWidth: dist,
            buttonWidth: `calc(100% - ${insetR * 2}px)`,
            buttonHeight: `calc(100% - ${insetY * 2}px)`,
            borderRadius: `${rad}px`,
            marginRight: `${insetR}px`,
            iconScale: 0.92 + t * 0.08,
            iconOpacity: 1,
            labelOpacity: Math.max(0, (t - 0.2) / 0.8),
            isSpherical: false,
        };
    }

    // Fully revealed card shape phase (dist >= actionWidth)
    return {
        containerWidth: dist,
        buttonWidth: '100%',
        buttonHeight: '100%',
        borderRadius: '16px',
        marginRight: '0px',
        iconScale: 1,
        iconOpacity: 1,
        labelOpacity: 1,
        isSpherical: false,
    };
};

export const SwipeableRow: React.FC<SwipeableRowProps> = ({
    id,
    children,
    onDelete,
    canDelete = true,
    onLongPress,
    onClick,
    disabled = false,
    className = '',
    index,
    animateEnter = true,
}) => {
    const [offsetX, setOffsetX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isPressed, setIsPressed] = useState(false);
    const [isFullSwipeArmed, setIsFullSwipeArmed] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [isCollapsing, setIsCollapsing] = useState(false);

    // Animation Sanity & Idempotency: only animate genuinely new/unseen items
    const isInitialEnterRef = useRef<boolean | null>(null);
    if (isInitialEnterRef.current === null) {
        isInitialEnterRef.current = shouldAnimateCard(id, animateEnter);
    }
    const [hasEntered, setHasEntered] = useState(!isInitialEnterRef.current);

    useEffect(() => {
        if (isInitialEnterRef.current && !hasEntered) {
            const delayMs = typeof index === 'number' ? Math.min(index * 36, 250) : 0;
            const timer = setTimeout(() => {
                setHasEntered(true);
            }, 360 + delayMs);
            return () => clearTimeout(timer);
        }
    }, [index, hasEntered]);

    const startXRef = useRef(0);
    const startYRef = useRef(0);
    const currentOffsetRef = useRef(0);
    const isPointerDownRef = useRef(false);
    const hasDirectionLockedRef = useRef(false);
    const isHorizontalRef = useRef(false);
    const justDraggedRef = useRef(false);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fullSwipeFiredRef = useRef(false);
    const rowRef = useRef<HTMLDivElement>(null);
    const containerHeightRef = useRef<number | null>(null);

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
        setIsPressed(false);
    }, []);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (disabled) return;
        // Ignore secondary clicks
        if (e.button !== 0) return;

        startXRef.current = e.clientX;
        startYRef.current = e.clientY;
        isPointerDownRef.current = true;
        hasDirectionLockedRef.current = false;
        isHorizontalRef.current = false;
        fullSwipeFiredRef.current = false;

        // Capture initial height for collapse animation
        if (rowRef.current) {
            containerHeightRef.current = rowRef.current.offsetHeight;
        }

        // Start long-press timer if onLongPress provided and currently closed
        if (onLongPress && currentOffsetRef.current === 0) {
            setIsPressed(true);
            longPressTimerRef.current = setTimeout(() => {
                triggerHaptic('medium');
                setIsPressed(false);
                onLongPress();
            }, LONG_PRESS_DURATION);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isPointerDownRef.current || disabled) return;

        const diffX = e.clientX - startXRef.current;
        const diffY = e.clientY - startYRef.current;
        const absX = Math.abs(diffX);
        const absY = Math.abs(diffY);

        // 1. Gesture Slop Disambiguation Gate
        if (!hasDirectionLockedRef.current) {
            // Cancel long-press if movement exceeds 5px
            if (absX > 5 || absY > 5) {
                clearLongPress();
            }

            // Still in dead-zone slop
            if (absX < SLOP_THRESHOLD && absY < SLOP_THRESHOLD) {
                return;
            }

            // Determine primary axis
            if (absY >= absX * 0.85) {
                // Vertical scrolling: yield to native browser scroll
                hasDirectionLockedRef.current = true;
                isHorizontalRef.current = false;
                isPointerDownRef.current = false;
                setIsDragging(false);
                setIsPressed(false);
                return;
            }

            if (absX > absY && absX >= SLOP_THRESHOLD) {
                // Horizontal swipe confirmed!
                hasDirectionLockedRef.current = true;
                isHorizontalRef.current = true;
                notifyOpened();
                triggerHaptic('selection'); // Tactile "card lift" feedback
                setIsDragging(true);
                setIsPressed(false);

                // Pointer capture so fast swipes never slip
                try {
                    (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
                } catch {
                    // Ignore pointer capture fallback
                }
            }
        }

        // 2. Active Horizontal Dragging
        if (isHorizontalRef.current) {
            // Subtract slop offset so movement starts gracefully from 0
            const deltaX = diffX - Math.sign(diffX) * SLOP_THRESHOLD;
            const baseOffset = isOpen ? -ACTION_WIDTH : 0;
            const raw = baseOffset + deltaX;

            let computed: number;
            if (raw < 0) {
                const abs = Math.abs(raw);
                if (!canDelete) {
                    // Rubber-band resistance if deletion disallowed
                    computed = -Math.min(20, Math.pow(abs, 0.7) * 2);
                } else if (abs <= ACTION_WIDTH) {
                    // Linear 1:1 direct tracking
                    computed = -abs;
                } else {
                    // Luxurious progressive friction past action threshold
                    const excess = abs - ACTION_WIDTH;
                    computed = -(ACTION_WIDTH + Math.pow(excess, 0.82) * 0.65);
                }

                // Arm/disarm full-swipe delete
                const isArmed = Math.abs(computed) >= FULL_SWIPE_THRESHOLD;
                if (isArmed && !fullSwipeFiredRef.current) {
                    fullSwipeFiredRef.current = true;
                    triggerHaptic('medium');
                    setIsFullSwipeArmed(true);
                } else if (!isArmed && fullSwipeFiredRef.current) {
                    fullSwipeFiredRef.current = false;
                    triggerHaptic('selection');
                    setIsFullSwipeArmed(false);
                }
            } else {
                // Elastic resistance when dragging to the right (close/overscroll)
                computed = Math.min(28, Math.pow(raw, 0.7) * 2.2);
            }

            setOffsetX(computed);
            currentOffsetRef.current = computed;
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        clearLongPress();
        setIsPressed(false);

        if (!isPointerDownRef.current) return;
        isPointerDownRef.current = false;

        try {
            (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
        } catch {
            // Ignore
        }

        const wasDragging = isHorizontalRef.current;
        setIsDragging(false);
        isHorizontalRef.current = false;
        hasDirectionLockedRef.current = false;

        const current = currentOffsetRef.current;

        // If it was just a tap without drag
        if (!wasDragging || Math.abs(current) < 4) {
            if (isOpen) {
                // Tapping on card when open snaps it closed
                setOffsetX(0);
                currentOffsetRef.current = 0;
                setIsOpen(false);
                triggerHaptic('selection');
                return;
            }
            if (onClick) {
                onClick();
            }
            return;
        }

        // Debounce tap events after dragging
        justDraggedRef.current = true;
        setTimeout(() => {
            justDraggedRef.current = false;
        }, 180);

        // 1. Full Swipe Trigger: Smooth Exit & Collapse Animation
        if (canDelete && Math.abs(current) >= FULL_SWIPE_THRESHOLD && onDelete) {
            triggerHaptic('success');
            setIsExiting(true);
            setOffsetX(-window.innerWidth * 1.1);
            currentOffsetRef.current = -window.innerWidth * 1.1;

            // Step 1: Card slides off screen (190ms)
            setTimeout(() => {
                // Step 2: Row height collapses smoothly (220ms)
                setIsCollapsing(true);
                setTimeout(() => {
                    onDelete();
                    // Reset internal state after removal
                    setOffsetX(0);
                    currentOffsetRef.current = 0;
                    setIsOpen(false);
                    setIsFullSwipeArmed(false);
                    setIsExiting(false);
                    setIsCollapsing(false);
                }, 220);
            }, 190);
            return;
        }

        setIsFullSwipeArmed(false);

        // 2. Snap Open or Closed
        if (canDelete && current <= -ACTION_WIDTH * 0.45) {
            setOffsetX(-ACTION_WIDTH);
            currentOffsetRef.current = -ACTION_WIDTH;
            setIsOpen(true);
            triggerHaptic('light');
        } else {
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

    const dragDist = Math.max(0, -offsetX);
    const isRevealed = canDelete && (dragDist > 0 || isCollapsing);
    const morph = getDeleteMorphStyles(dragDist, ACTION_WIDTH, isFullSwipeArmed, isCollapsing);

    return (
        <div
            ref={rowRef}
            onAnimationEnd={() => setHasEntered(true)}
            style={{
                maxHeight: isCollapsing
                    ? '0px'
                    : containerHeightRef.current
                    ? `${containerHeightRef.current}px`
                    : undefined,
                opacity: isCollapsing ? 0 : undefined,
                marginBottom: isCollapsing ? '0px' : undefined,
                paddingTop: isCollapsing ? '0px' : undefined,
                paddingBottom: isCollapsing ? '0px' : undefined,
                animation:
                    !hasEntered && !isCollapsing
                        ? 'cardEnter 0.34s cubic-bezier(0.16, 1, 0.3, 1) both'
                        : undefined,
                animationDelay:
                    !hasEntered && !isCollapsing && typeof index === 'number'
                        ? `${Math.min(index * 36, 250)}ms`
                        : undefined,
                transition: isCollapsing
                    ? 'max-height 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, margin-bottom 0.24s cubic-bezier(0.16, 1, 0.3, 1), padding 0.24s ease'
                    : undefined,
            }}
            className={`relative overflow-hidden rounded-2xl will-change-transform ${className}`}
        >
            {/* Background Action Button (iOS Style Morphing Delete) */}
            {canDelete && (
                <div
                    aria-hidden={!isRevealed}
                    className="absolute inset-y-0 right-0 z-0 flex items-center justify-end overflow-hidden select-none pointer-events-auto"
                    style={{
                        width: isRevealed
                            ? isFullSwipeArmed
                                ? '100%'
                                : `${morph.containerWidth}px`
                            : '0px',
                        opacity: isRevealed ? 1 : 0,
                        visibility: isRevealed ? 'visible' : 'hidden',
                        transition: isDragging
                            ? 'none'
                            : 'width 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
                    }}
                >
                    <button
                        type="button"
                        onClick={handleDeleteClick}
                        aria-label="Delete item"
                        className={`flex flex-col items-center justify-center text-white cursor-pointer select-none overflow-hidden active:opacity-90 transition-colors duration-200 ${
                            isFullSwipeArmed
                                ? 'bg-gradient-to-l from-red-600 via-rose-600 to-rose-700 shadow-md'
                                : 'bg-gradient-to-l from-red-500 via-rose-500 to-rose-600 shadow-xs'
                        }`}
                        style={{
                            width: morph.buttonWidth,
                            height: morph.buttonHeight,
                            borderRadius: morph.borderRadius,
                            marginRight: morph.marginRight,
                            transition: isDragging
                                ? 'background-color 0.2s ease'
                                : 'all 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                    >
                        <div
                            className="flex items-center justify-center transition-transform duration-150"
                            style={{
                                transform: `scale(${morph.iconScale})`,
                                opacity: morph.iconOpacity,
                            }}
                        >
                            <AppIcon
                                name={isFullSwipeArmed ? 'delete_forever' : 'delete'}
                                className={morph.isSpherical ? 'text-[18px]' : 'text-[20px]'}
                            />
                        </div>
                        {!morph.isSpherical && (
                            <span
                                className="leading-tight text-[10px] font-bold tracking-tight uppercase"
                                style={{
                                    opacity: morph.labelOpacity,
                                    maxHeight: morph.labelOpacity > 0 ? '14px' : '0px',
                                    transition: isDragging ? 'none' : 'opacity 0.2s ease',
                                }}
                            >
                                {isFullSwipeArmed ? 'Release' : 'Delete'}
                            </span>
                        )}
                    </button>
                </div>
            )}

            {/* Foreground Card Content */}
            <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={handleCardClick}
                style={{
                    transform: `translate3d(${offsetX}px, 0, 0) scale(${isPressed ? 0.985 : 1})`,
                    boxShadow:
                        isDragging && offsetX < 0
                            ? '-8px 0 28px -4px rgba(0, 0, 0, 0.16), -2px 0 10px -2px rgba(0, 0, 0, 0.08)'
                            : undefined,
                    transition: isDragging
                        ? 'none'
                        : isExiting
                        ? 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease'
                        : 'transform 0.34s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease',
                    touchAction: 'pan-y',
                }}
                className={`relative z-10 w-full will-change-transform select-none ${
                    isExiting ? 'opacity-0' : 'opacity-100'
                }`}
            >
                {children}
            </div>
        </div>
    );
};

export default SwipeableRow;
