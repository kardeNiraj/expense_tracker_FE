import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface PullToRefreshProps {
    onRefresh: () => Promise<unknown> | void;
    children: React.ReactNode;
    disabled?: boolean;
    pullThreshold?: number;
    maxPull?: number;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
    onRefresh,
    children,
    disabled = false,
    pullThreshold = 65,
    maxPull = 110,
}) => {
    const [pullY, setPullY] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPulling, setIsPulling] = useState(false);

    const startYRef = useRef(0);
    const startXRef = useRef(0);
    const isDraggingRef = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const progress = Math.min(1, pullY / pullThreshold);

    const handleTouchStart = useCallback(
        (e: TouchEvent) => {
            if (disabled || isRefreshing) return;
            const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
            if (scrollTop <= 2) {
                startYRef.current = e.touches[0].clientY;
                startXRef.current = e.touches[0].clientX;
                isDraggingRef.current = true;
            }
        },
        [disabled, isRefreshing]
    );

    const handleTouchMove = useCallback(
        (e: TouchEvent) => {
            if (!isDraggingRef.current || isRefreshing || disabled) return;

            const currentY = e.touches[0].clientY;
            const currentX = e.touches[0].clientX;
            const diffY = currentY - startYRef.current;
            const diffX = currentX - startXRef.current;

            const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
            if (scrollTop <= 2 && diffY > 0 && diffY > Math.abs(diffX) * 1.2) {
                const distance = Math.min(maxPull, diffY * 0.42);
                setPullY(distance);
                setIsPulling(true);

                if (e.cancelable && diffY > 10) {
                    e.preventDefault();
                }
            } else if (diffY < 0) {
                isDraggingRef.current = false;
                setIsPulling(false);
                setPullY(0);
            }
        },
        [disabled, isRefreshing, maxPull]
    );

    const handleTouchEnd = useCallback(async () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        setIsPulling(false);

        if (pullY >= pullThreshold && !isRefreshing) {
            setIsRefreshing(true);
            setPullY(48); // Hold spinner in view while refreshing
            try {
                if (navigator.vibrate) {
                    navigator.vibrate(15);
                }
                await onRefresh();
            } finally {
                setIsRefreshing(false);
                setPullY(0);
            }
        } else {
            setPullY(0);
        }
    }, [pullY, pullThreshold, isRefreshing, onRefresh]);

    useEffect(() => {
        const target = containerRef.current || window;

        const onTouchStart = (e: TouchEvent) => handleTouchStart(e);
        const onTouchMove = (e: TouchEvent) => handleTouchMove(e);
        const onTouchEnd = () => handleTouchEnd();

        target.addEventListener('touchstart', onTouchStart as EventListener, { passive: true });
        target.addEventListener('touchmove', onTouchMove as EventListener, { passive: false });
        target.addEventListener('touchend', onTouchEnd as EventListener);
        target.addEventListener('touchcancel', onTouchEnd as EventListener);

        return () => {
            target.removeEventListener('touchstart', onTouchStart as EventListener);
            target.removeEventListener('touchmove', onTouchMove as EventListener);
            target.removeEventListener('touchend', onTouchEnd as EventListener);
            target.removeEventListener('touchcancel', onTouchEnd as EventListener);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    return (
        <div ref={containerRef} className="relative w-full min-h-full">
            {/* Pull Indicator Pill */}
            <div
                className="fixed top-18 inset-x-0 flex justify-center z-40 pointer-events-none transition-all duration-200"
                style={{
                    transform: `translateY(${pullY > 0 || isRefreshing ? Math.min(pullY, 48) : -60}px)`,
                    opacity: pullY > 8 || isRefreshing ? 1 : 0,
                    transition: isPulling ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s',
                }}
            >
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container-highest/95 backdrop-blur-md border border-outline-variant/40 shadow-xl text-xs font-semibold text-on-surface">
                    <span
                        className={`material-symbols-outlined text-[18px] text-primary ${
                            isRefreshing ? 'animate-spin' : ''
                        }`}
                        style={{
                            transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)`,
                            transition: isPulling ? 'none' : 'transform 0.15s',
                        }}
                    >
                        {isRefreshing ? 'progress_activity' : progress >= 1 ? 'autorenew' : 'arrow_downward'}
                    </span>
                    <span className="font-sans">
                        {isRefreshing
                            ? 'Reloading from Sheet...'
                            : progress >= 1
                            ? 'Release to reload'
                            : 'Pull down to reload'}
                    </span>
                </div>
            </div>

            {/* Main Children */}
            {children}
        </div>
    );
};

export default PullToRefresh;
