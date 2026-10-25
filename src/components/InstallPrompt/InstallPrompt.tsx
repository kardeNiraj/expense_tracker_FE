import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const InstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showIosGuide, setShowIosGuide] = useState(false);

    const [isDismissed, setIsDismissed] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return sessionStorage.getItem('pwa_prompt_dismissed') === 'true';
    });

    const [isIos] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    });

    const [isStandalone, setIsStandalone] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return (
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
            document.referrer.includes('android-app://')
        );
    });

    useEffect(() => {
        // Listen for beforeinstallprompt event (Android / Chromium / Edge / Desktop)
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Listen for appinstalled event
        const handleAppInstalled = () => {
            setIsStandalone(true);
            setDeferredPrompt(null);
        };

        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    const handleDismiss = () => {
        setIsDismissed(true);
        sessionStorage.setItem('pwa_prompt_dismissed', 'true');
    };

    // Don't show if already installed, dismissed, or neither installable prompt nor iOS
    if (isStandalone || isDismissed) {
        return null;
    }

    if (!deferredPrompt && !isIos) {
        return null;
    }

    return (
        <aside
            aria-label="Install SplitNest application"
            className="w-full mb-4 bg-gradient-to-r from-primary-50 via-surface-container to-secondary-50 border border-primary-200/80 rounded-2xl p-3.5 shadow-sm transition-all animate-in fade-in slide-in-from-top-2 duration-300"
        >
            <div className="flex items-center gap-3">
                <img
                    src="/pwa-192x192.png"
                    alt="SplitNest Icon"
                    className="w-10 h-10 rounded-xl shadow-xs border border-white/80 shrink-0 object-cover"
                />
                <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-on-surface font-headline truncate">
                        Install SplitNest App
                    </h4>
                    <p className="text-[11px] text-on-surface-variant leading-tight">
                        One-tap access directly from your home screen
                    </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {deferredPrompt && (
                        <button
                            type="button"
                            onClick={handleInstallClick}
                            className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined text-[15px]">download</span>
                            <span>Install</span>
                        </button>
                    )}

                    {isIos && !deferredPrompt && (
                        <button
                            type="button"
                            onClick={() => setShowIosGuide(!showIosGuide)}
                            className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined text-[15px]">ios_share</span>
                            <span>Install</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="w-7 h-7 rounded-lg hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                        aria-label="Dismiss install banner"
                    >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                </div>
            </div>

            {/* iOS Step-by-Step Instructions */}
            {isIos && showIosGuide && (
                <div className="mt-3 pt-3 border-t border-primary-200/60 text-xs text-on-surface-variant space-y-2">
                    <p className="font-semibold text-primary text-[11px] uppercase tracking-wider">
                        How to install on iPhone / iPad:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-on-surface">
                        <li>
                            Tap the <span className="font-semibold inline-flex items-center gap-0.5"><span className="material-symbols-outlined text-[13px] text-primary">ios_share</span> Share</span> button at the bottom of Safari.
                        </li>
                        <li>
                            Scroll down in the share sheet and tap <span className="font-semibold inline-flex items-center gap-0.5"><span className="material-symbols-outlined text-[13px] text-primary">add_box</span> Add to Home Screen</span>.
                        </li>
                        <li>
                            Tap <span className="font-semibold text-primary">Add</span> in the top right corner.
                        </li>
                    </ol>
                </div>
            )}
        </aside>
    );
};

export default InstallPrompt;
