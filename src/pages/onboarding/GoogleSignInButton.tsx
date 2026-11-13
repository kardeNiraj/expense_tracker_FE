import React, { useEffect, useRef, useState } from 'react';
import { AppIcon } from '../../components';

interface GoogleCredentialResponse {
    credential?: string;
}

interface GoogleAccountsId {
    initialize: (config: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
    }) => void;
    renderButton: (
        parent: HTMLElement,
        options: {
            theme?: 'outline' | 'filled_blue' | 'filled_black';
            size?: 'large' | 'medium' | 'small';
            text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
            shape?: 'rectangular' | 'pill' | 'circle' | 'square';
            width?: number;
        }
    ) => void;
}

interface WindowWithGoogle extends Window {
    google?: {
        accounts?: {
            id?: GoogleAccountsId;
        };
    };
}

const GSI_SCRIPT_ID = 'google-gsi-client-script';
let gsiLoadPromise: Promise<boolean> | null = null;

function loadGoogleGsiScript(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return Promise.resolve(false);
    }
    const win = window as WindowWithGoogle;
    if (win.google?.accounts?.id) {
        return Promise.resolve(true);
    }
    if (gsiLoadPromise) {
        return gsiLoadPromise;
    }

    gsiLoadPromise = new Promise<boolean>((resolve) => {
        const existing = document.getElementById(GSI_SCRIPT_ID) as HTMLScriptElement | null;
        if (existing) {
            existing.addEventListener('load', () => resolve(Boolean(win.google?.accounts?.id)));
            existing.addEventListener('error', () => resolve(false));
            return;
        }

        const script = document.createElement('script');
        script.id = GSI_SCRIPT_ID;
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(Boolean((window as WindowWithGoogle).google?.accounts?.id));
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });

    return gsiLoadPromise;
}

interface GoogleSignInButtonProps {
    clientId?: string | null;
    enabled?: boolean;
    disabled?: boolean;
    onCredential: (credential: string) => void | Promise<void>;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
    clientId,
    enabled,
    disabled = false,
    onCredential,
}) => {
    const buttonContainerRef = useRef<HTMLDivElement | null>(null);
    const onCredentialRef = useRef(onCredential);
    const [sdkState, setSdkState] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');

    useEffect(() => {
        onCredentialRef.current = onCredential;
    }, [onCredential]);

    const cleanClientId = (clientId || '').trim();
    const isGoogleConfigured = Boolean(enabled && cleanClientId);

    useEffect(() => {
        if (!isGoogleConfigured) return;

        let cancelled = false;
        void Promise.resolve().then(() => {
            if (!cancelled) setSdkState('loading');
        });

        void loadGoogleGsiScript().then((loaded) => {
            if (cancelled) return;
            const gsi = (window as WindowWithGoogle).google?.accounts?.id;
            const container = buttonContainerRef.current;
            if (!loaded || !gsi || !container) {
                setSdkState('unavailable');
                return;
            }

            try {
                container.innerHTML = '';
                gsi.initialize({
                    client_id: cleanClientId,
                    callback: (response) => {
                        if (response?.credential) {
                            void onCredentialRef.current(response.credential);
                        }
                    },
                });
                gsi.renderButton(container, {
                    theme: 'outline',
                    size: 'large',
                    text: 'continue_with',
                    shape: 'pill',
                    width: Math.min(340, container.clientWidth || 300),
                });
                setSdkState('ready');
            } catch {
                setSdkState('unavailable');
            }
        });

        return () => {
            cancelled = true;
        };
    }, [cleanClientId, isGoogleConfigured]);

    if (!isGoogleConfigured) {
        return (
            <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/25 flex items-center gap-2.5 text-xs text-on-surface-variant">
                <AppIcon name="info" className="text-[17px] text-primary shrink-0" />
                <span>
                    Google Sign-In activates automatically once{' '}
                    <code className="font-mono text-[11px] text-on-surface">GOOGLE_CLIENT_ID</code>{' '}
                    is configured on the server. Use Email or Quick PIN above anytime!
                </span>
            </div>
        );
    }

    return (
        <div className={`space-y-2 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
            <div className="flex justify-center min-h-[44px]" ref={buttonContainerRef} />
            {sdkState === 'loading' && (
                <p className="text-[11px] text-center text-on-surface-variant">
                    Loading Google Sign-In...
                </p>
            )}
            {sdkState === 'unavailable' && (
                <p className="text-[11px] text-center text-tertiary">
                    Could not load Google Sign-In script (offline or blocked). Use Email or Quick PIN instead.
                </p>
            )}
        </div>
    );
};

export default GoogleSignInButton;

