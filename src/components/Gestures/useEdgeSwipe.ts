import { useState, useRef, useEffect, useCallback } from 'react';
import { triggerHaptic } from '../../utils/haptics';

export interface UseEdgeSwipeOptions {
    onBack: () => void;
    edgeWidth?: number; // Distance from left edge in px to initiate edge swipe (default 32)
    threshold?: number; // Minimum horizontal drag in px to trigger back (default 100)
    enabled?: boolean;
}

export function useEdgeSwipe({
    onBack,
    edgeWidth = 32,
    threshold = 100,
    enabled = true,
}: UseEdgeSwipeOptions) {
    const [dragX, setDragX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const startXRef = useRef(0);
    const startYRef = useRef(0);
    const isEdgeCandidateRef = useRef(false);
    const isSwipingRef = useRef(false);
    const lastDragXRef = useRef(0);
    const isMountedRef = useRef(true);
    const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = useCallback(
        (e: TouchEvent) => {
            if (!enabled) return;
            const touch = e.touches[0];
            if (!touch) return;

            // Only trigger if touch originates near the left edge of the viewport
            if (touch.clientX <= edgeWidth) {
                startXRef.current = touch.clientX;
                startYRef.current = touch.clientY;
                isEdgeCandidateRef.current = true;
                isSwipingRef.current = false;
                lastDragXRef.current = 0;
            }
        },
        [enabled, edgeWidth]
    );

    const handleTouchMove = useCallback(
        (e: TouchEvent) => {
            if (!isEdgeCandidateRef.current || !enabled) return;
            const touch = e.touches[0];
            if (!touch) return;

            const diffX = touch.clientX - startXRef.current;
            const diffY = touch.clientY - startYRef.current;

            // Disambiguate horizontal swipe from vertical scroll
            if (!isSwipingRef.current) {
                if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 8) {
                    isEdgeCandidateRef.current = false;
                    return;
                }
                if (diffX > 8 && diffX > Math.abs(diffY)) {
                    isSwipingRef.current = true;
                    setIsSwiping(true);
                    triggerHaptic('selection');
                }
            }

            if (isSwipingRef.current && diffX >= 0) {
                if (e.cancelable) {
                    e.preventDefault();
                }
                // Damped horizontal translation following finger
                const boundedX = Math.max(0, diffX);
                lastDragXRef.current = boundedX;
                setDragX(boundedX);
            }
        },
        [enabled]
    );

    const handleTouchEnd = useCallback(() => {
        if (!isEdgeCandidateRef.current) return;
        isEdgeCandidateRef.current = false;

        const currentX = lastDragXRef.current;
        if (isSwipingRef.current) {
            isSwipingRef.current = false;
            setIsSwiping(false);

            if (currentX >= threshold) {
                triggerHaptic('light');
                setDragX(typeof window !== 'undefined' ? window.innerWidth : 400);
                exitTimerRef.current = setTimeout(() => {
                    onBack();
                    if (isMountedRef.current) {
                        setDragX(0);
                    }
                }, 180);
            } else {
                setDragX(0);
            }
        } else {
            setDragX(0);
        }
    }, [threshold, onBack]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (exitTimerRef.current) {
                clearTimeout(exitTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const el = containerRef.current || (typeof window !== 'undefined' ? window : null);
        if (!el) return;

        const onStart = (e: TouchEvent) => handleTouchStart(e);
        const onMove = (e: TouchEvent) => handleTouchMove(e);
        const onEnd = () => handleTouchEnd();

        el.addEventListener('touchstart', onStart as EventListener, { passive: true });
        el.addEventListener('touchmove', onMove as EventListener, { passive: false });
        el.addEventListener('touchend', onEnd as EventListener);
        el.addEventListener('touchcancel', onEnd as EventListener);

        return () => {
            el.removeEventListener('touchstart', onStart as EventListener);
            el.removeEventListener('touchmove', onMove as EventListener);
            el.removeEventListener('touchend', onEnd as EventListener);
            el.removeEventListener('touchcancel', onEnd as EventListener);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    const progress = Math.min(1, dragX / (typeof window !== 'undefined' ? window.innerWidth : 360));
    const backdropOpacity = Math.max(0, 1 - progress * 0.9);

    return {
        containerRef,
        dragX,
        isSwiping,
        progress,
        backdropOpacity,
    };
}
