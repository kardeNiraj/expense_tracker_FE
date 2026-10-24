import React, { useEffect, useState } from 'react';

interface MobileGateProps {
    children: React.ReactNode;
    breakpoint?: number;
}

export const MobileGate: React.FC<MobileGateProps> = ({ children, breakpoint = 768 }) => {
    const [windowWidth, setWindowWidth] = useState<number>(() => {
        return typeof window !== 'undefined' ? window.innerWidth : 1024;
    });
    const [copied, setCopied] = useState(false);
    const [previewInDesktop, setPreviewInDesktop] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleCopyUrl = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // fallback if clipboard api fails
        }
    };

    // Calculate progress towards reaching mobile breakpoint
    const progressPercent = Math.min(
        100,
        Math.max(10, Math.round((breakpoint / Math.max(windowWidth, 1)) * 100))
    );

    return (
        <>
            {/* =========================================================================
                DESKTOP RESTRICTION SCREEN (Visible only on screens >= 768px via md:flex)
                Using pure CSS responsive classes so resizing responds with ZERO delay
               ========================================================================= */}
            <div
                className="hidden md:flex min-h-screen w-full relative overflow-hidden bg-neutral-50 text-neutral-900 flex-col items-center justify-center p-6 select-none"
                aria-label="Desktop screen blocker"
            >
                {/* Ambient glow backgrounds using theme primary/secondary colors */}
                <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary-200/50 rounded-full blur-3xl pointer-events-none animate-pulse" />
                <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-secondary-200/50 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-100/40 rounded-full blur-3xl pointer-events-none" />

                {/* Subtle grid pattern overlay */}
                <div
                    className="absolute inset-0 opacity-[0.04] pointer-events-none"
                    style={{
                        backgroundImage: `radial-gradient(circle at 1px 1px, #1a1a1a 1px, transparent 0)`,
                        backgroundSize: '32px 32px',
                    }}
                />

                {/* Main Card */}
                <div className="relative z-10 max-w-lg w-full bg-white/95 border border-neutral-200/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl shadow-neutral-900/5 text-center">

                    {/* Status Pill Badge */}
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-xs font-semibold tracking-wide uppercase mb-6">
                        <span className="w-2 h-2 rounded-full bg-primary-500 animate-ping" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-500 -ml-3" />
                        Mobile-Only Experience
                    </div>

                    {/* Animated Phone Graphic */}
                    <div className="relative mx-auto mb-6 w-24 h-40 rounded-2xl border-4 border-neutral-200 bg-white shadow-md flex flex-col items-center justify-between p-2 group hover:border-primary-400 transition-colors duration-300">
                        {/* Speaker Notch */}
                        <div className="w-8 h-1 bg-neutral-200 rounded-full group-hover:bg-primary-300 transition-colors" />

                        {/* Screen Content Preview */}
                        <div className="w-full flex-1 my-1.5 bg-neutral-50 rounded-lg flex flex-col items-center justify-center p-2 border border-neutral-200/70">
                            {/* Animated screen icon */}
                            <svg
                                className="w-8 h-8 text-primary-600 animate-bounce"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="1.8"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                                />
                            </svg>
                            <span className="text-[9px] font-medium text-neutral-500 mt-1">Ready</span>
                        </div>

                        {/* Home indicator bar */}
                        <div className="w-10 h-1 bg-neutral-200 rounded-full" />
                    </div>

                    {/* Headings */}
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight mb-2">
                        Please Open on Mobile
                    </h1>
                    <p className="text-neutral-600 text-sm leading-relaxed mb-6">
                        Expense Tracker is crafted specifically for mobile screens for fast, seamless expense tracking on the go.
                    </p>

                    {/* Live Responsive Resize Monitor */}
                    <div className="bg-neutral-50 border border-neutral-200/80 rounded-2xl p-4 mb-6 text-left">
                        <div className="flex items-center justify-between text-xs font-medium text-neutral-700 mb-2">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-secondary-500" />
                                Live Window Width
                            </span>
                            <span className="font-mono text-secondary-700 font-semibold">
                                {windowWidth}px <span className="text-neutral-400 font-normal">/ target &lt; {breakpoint}px</span>
                            </span>
                        </div>

                        {/* Progress Bar towards Mobile Width */}
                        <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 transition-all duration-150 ease-out rounded-full"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>

                        <p className="text-[11px] text-neutral-500 mt-2 flex items-center justify-between">
                            <span>Resize your browser narrower to trigger mobile mode</span>
                            <span className="font-mono text-primary-700 font-semibold">{progressPercent}%</span>
                        </p>
                    </div>

                    {/* Quick Action & Testing Tips */}
                    <div className="grid grid-cols-2 gap-3 text-left">
                        {/* Tip 1: DevTools */}
                        <div className="bg-neutral-50/80 border border-neutral-200/80 rounded-xl p-3 hover:border-neutral-300 transition-colors">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800 mb-1">
                                <svg className="w-3.5 h-3.5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                                DevTools Mode
                            </div>
                            <p className="text-[11px] text-neutral-600 leading-snug">
                                Press <kbd className="px-1 py-0.5 bg-neutral-200/90 border border-neutral-300/60 rounded text-[10px] text-neutral-800 font-mono">F12</kbd> or <kbd className="px-1 py-0.5 bg-neutral-200/90 border border-neutral-300/60 rounded text-[10px] text-neutral-800 font-mono">⌘+Opt+I</kbd> and toggle Device Mode (<kbd className="px-1 py-0.5 bg-neutral-200/90 border border-neutral-300/60 rounded text-[10px] text-neutral-800 font-mono">⌘+Shift+M</kbd>).
                            </p>
                        </div>

                        {/* Tip 2: Copy URL / Test on Phone */}
                        <div className="bg-neutral-50/80 border border-neutral-200/80 rounded-xl p-3 hover:border-neutral-300 transition-colors flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800 mb-1">
                                    <svg className="w-3.5 h-3.5 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                    Share Link
                                </div>
                                <p className="text-[11px] text-neutral-600 leading-snug">
                                    Copy current URL to open directly on your mobile browser.
                                </p>
                            </div>
                            <button
                                onClick={handleCopyUrl}
                                type="button"
                                className="mt-2 w-full py-1.5 px-2 rounded-lg bg-white hover:bg-neutral-100 text-neutral-700 text-[11px] font-medium border border-neutral-300 hover:border-primary-400 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                            >
                                {copied ? (
                                    <>
                                        <svg className="w-3 h-3 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="text-primary-600 font-semibold">Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3 h-3 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        <span>Copy App Link</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Preview directly in desktop simulator */}
                    <button
                        onClick={() => setPreviewInDesktop(true)}
                        type="button"
                        className="w-full mt-4 py-2.5 px-4 rounded-xl bg-primary text-on-primary text-xs font-semibold shadow-md flex items-center justify-center gap-2 hover:bg-primary-container transition-all cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[18px]">smartphone</span>
                        <span>Preview in Mobile Frame</span>
                    </button>
                </div>

                {/* Footer note */}
                <div className="relative z-10 mt-6 text-xs text-neutral-500 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                    <span>Auto-activates the instant screen width is reduced below {breakpoint}px</span>
                </div>
            </div>

            {/* Desktop Simulator View */}
            {previewInDesktop && (
                <div className="hidden md:flex fixed inset-0 z-50 bg-neutral-900/90 py-6 px-4 flex-col items-center justify-center overflow-y-auto">
                    <div className="w-full max-w-[420px] mb-2 flex items-center justify-between text-xs text-white/80 px-2">
                        <span className="flex items-center gap-1.5 font-medium">
                            <span className="w-2 h-2 rounded-full bg-primary-fixed animate-pulse" />
                            Mobile Simulator Mode
                        </span>
                        <button
                            type="button"
                            onClick={() => setPreviewInDesktop(false)}
                            className="hover:text-white underline cursor-pointer text-xs"
                        >
                            Exit Preview
                        </button>
                    </div>
                    <div className="w-full max-w-[420px] max-h-[90vh] bg-surface rounded-[36px] shadow-2xl border-4 border-neutral-700 overflow-y-auto relative flex flex-col no-scrollbar">
                        {children}
                    </div>
                </div>
            )}

            {/* =========================================================================
                MOBILE APPLICATION CONTAINER (Visible only on screens < 768px via md:hidden)
                Shows instantly upon resize, without any reload or delay
               ========================================================================= */}
            <div className="block md:hidden min-h-screen w-full">
                {children}
            </div>
        </>
    );
};

export default MobileGate;
