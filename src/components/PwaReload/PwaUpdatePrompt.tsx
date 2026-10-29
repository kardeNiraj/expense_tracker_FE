import React, { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { triggerHaptic } from '../../utils/haptics';

export const PwaUpdatePrompt: React.FC = () => {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            if (r) {
                // Check for updates every 10 minutes
                setInterval(() => {
                    r.update().catch(() => {});
                }, 10 * 60 * 1000);
            }
        },
        onRegisterError(error) {
            console.error('SW registration error:', error);
        },
    });

    // Check for updates whenever user returns to the app from background
    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible' && 'serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then((reg) => {
                    reg.update().catch(() => {});
                }).catch(() => {});
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, []);

    if (!needRefresh) return null;

    const handleReload = () => {
        triggerHaptic('success');
        updateServiceWorker(true);
    };

    return (
        <div className="fixed top-3 inset-x-0 z-60 flex justify-center px-4 animate-in slide-in-from-top duration-300 pointer-events-auto">
            <div className="bg-primary text-on-primary px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-primary-container max-w-sm w-full justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px] text-white">
                            rocket_launch
                        </span>
                    </div>
                    <div className="min-w-0 text-left">
                        <div className="font-bold text-xs truncate">New Version Available!</div>
                        <div className="text-[11px] text-on-primary/80 truncate">Tap to reload the latest code.</div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        type="button"
                        onClick={handleReload}
                        className="h-8 px-3 rounded-xl bg-white text-primary text-xs font-bold hover:bg-neutral-100 transition-colors shadow-xs cursor-pointer active:scale-95"
                    >
                        Reload
                    </button>
                    <button
                        type="button"
                        onClick={() => setNeedRefresh(false)}
                        className="w-8 h-8 rounded-xl text-on-primary hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                        title="Dismiss"
                    >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PwaUpdatePrompt;

