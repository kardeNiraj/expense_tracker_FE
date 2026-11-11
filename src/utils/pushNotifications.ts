import {
    getVapidPublicKeyApi,
    sendTestPushApi,
    subscribePushApi,
    unsubscribePushApi,
} from '../api/pushApi';
import type { PushPublicConfig, WebPushSubscriptionPayload } from '../api/types';
import { getActiveAdminToken, getStoredClaimedPerson } from './deviceIdentity';

const PUSH_PAUSED_STORAGE_KEY = 'splitnest_push_paused';
const PUSH_PROMPT_DISMISSED_KEY = 'splitnest_push_prompt_dismissed';

let lastSyncedSessionKey: string | null = null;
let syncInFlightPromise: Promise<boolean> | null = null;

export interface EnablePushResult {
    ok: boolean;
    reason?:
        | 'UNSUPPORTED'
        | 'OFFLINE'
        | 'PERMISSION_DENIED'
        | 'PERMISSION_DISMISSED'
        | 'NOT_CONFIGURED'
        | 'SW_UNAVAILABLE'
        | 'SUBSCRIBE_FAILED';
    message?: string;
    isAdmin?: boolean;
    person?: string | null;
}

export function isPushSupported(): boolean {
    return (
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    );
}

export function isStandalonePwa(): boolean {
    if (typeof window === 'undefined') return false;
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://')
    );
}

export function isIosSafariNotStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent || '';
    const isIosDevice = /iphone|ipad|ipod/i.test(ua);
    return isIosDevice && !isStandalonePwa();
}

export function getNotificationPermissionState(): NotificationPermission | 'unsupported' {
    if (!isPushSupported()) return 'unsupported';
    return Notification.permission;
}

export function isPushPausedLocally(): boolean {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return false;
        return window.localStorage.getItem(PUSH_PAUSED_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

export function setPushPausedLocally(paused: boolean): void {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        if (paused) {
            window.localStorage.setItem(PUSH_PAUSED_STORAGE_KEY, 'true');
        } else {
            window.localStorage.removeItem(PUSH_PAUSED_STORAGE_KEY);
        }
    } catch {
        // Ignore storage restrictions
    }
}

export function isPushPromptDismissed(): boolean {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return false;
        return window.localStorage.getItem(PUSH_PROMPT_DISMISSED_KEY) === 'true';
    } catch {
        return false;
    }
}

export function dismissPushPrompt(): void {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        window.localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, 'true');
    } catch {
        // Ignore storage restrictions
    }
}

export function resetPushSyncSession(): void {
    lastSyncedSessionKey = null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const clean = base64String.trim();
    const padding = '='.repeat((4 - (clean.length % 4)) % 4);
    const base64 = (clean + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const buffer = new ArrayBuffer(rawData.length);
    const outputArray = new Uint8Array(buffer);
    for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function arrayBuffersEqual(
    existingKey: ArrayBuffer | null | undefined,
    expectedKey: Uint8Array<ArrayBuffer>
): boolean {
    if (!existingKey) return true;
    const viewA = new Uint8Array(existingKey);
    if (viewA.byteLength !== expectedKey.byteLength) return false;
    for (let i = 0; i < viewA.byteLength; i++) {
        if (viewA[i] !== expectedKey[i]) return false;
    }
    return true;
}

function serializePushSubscription(
    subscription: PushSubscription
): WebPushSubscriptionPayload | null {
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        return null;
    }
    return {
        endpoint: json.endpoint,
        expirationTime: json.expirationTime ?? null,
        keys: {
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
        },
    };
}

async function getActiveServiceWorkerRegistration(
    timeoutMs = 8000
): Promise<ServiceWorkerRegistration | null> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
        return null;
    }

    try {
        const existing = await navigator.serviceWorker.getRegistration();
        if (existing?.active) {
            return existing;
        }

        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length === 0) {
            // In non-PWA local Vite dev without devOptions SW, fail quickly instead of hanging forever
            return await Promise.race<ServiceWorkerRegistration | null>([
                navigator.serviceWorker.ready,
                new Promise((resolve) => window.setTimeout(() => resolve(null), 2000)),
            ]);
        }

        return await Promise.race<ServiceWorkerRegistration | null>([
            navigator.serviceWorker.ready,
            new Promise((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
        ]);
    } catch {
        return null;
    }
}

export async function enablePushNotifications(params?: {
    person?: string | null;
    config?: PushPublicConfig | null;
}): Promise<EnablePushResult> {
    if (!isPushSupported()) {
        return {
            ok: false,
            reason: 'UNSUPPORTED',
            message: isIosSafariNotStandalone()
                ? 'On iPhone/iPad, tap Share → Add to Home Screen first to enable push notifications.'
                : 'Push notifications are not supported in this browser.',
        };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return {
            ok: false,
            reason: 'OFFLINE',
            message: 'Internet connection required to enable push alerts.',
        };
    }

    if (Notification.permission === 'denied') {
        return {
            ok: false,
            reason: 'PERMISSION_DENIED',
            message:
                'Notifications are blocked in your browser settings. Enable them in Site Settings to receive alerts.',
        };
    }

    let permission: NotificationPermission = Notification.permission;
    if (permission === 'default') {
        try {
            permission = await Notification.requestPermission();
        } catch {
            return {
                ok: false,
                reason: 'PERMISSION_DISMISSED',
                message: 'Could not request notification permission.',
            };
        }
    }

    if (permission !== 'granted') {
        return {
            ok: false,
            reason:
                permission === 'denied' ? 'PERMISSION_DENIED' : 'PERMISSION_DISMISSED',
            message:
                permission === 'denied'
                    ? 'Notifications blocked. Enable them in browser Site Settings.'
                    : 'Notification permission dismissed.',
        };
    }

    try {
        const config = params?.config?.publicKey
            ? params.config
            : await getVapidPublicKeyApi();

        if (!config.configured || !config.publicKey) {
            return {
                ok: false,
                reason: 'NOT_CONFIGURED',
                message: 'Push alerts are not configured on the server yet.',
            };
        }

        const registration = await getActiveServiceWorkerRegistration();
        if (!registration) {
            return {
                ok: false,
                reason: 'SW_UNAVAILABLE',
                message:
                    'Service Worker is not active yet. Install or reload the production PWA and try again.',
            };
        }

        const expectedKey = urlBase64ToUint8Array(config.publicKey);
        let subscription = await registration.pushManager.getSubscription();

        if (subscription && !arrayBuffersEqual(subscription.options?.applicationServerKey, expectedKey)) {
            await subscription.unsubscribe().catch(() => {});
            subscription = null;
        }

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: expectedKey,
            });
        }

        const serialized = serializePushSubscription(subscription);
        if (!serialized) {
            return {
                ok: false,
                reason: 'SUBSCRIBE_FAILED',
                message: 'Browser failed to generate encryption keys for notifications.',
            };
        }

        const resolvedPerson = params?.person ?? getStoredClaimedPerson() ?? '';
        const res = await subscribePushApi({
            subscription: serialized,
            person: resolvedPerson,
        });

        setPushPausedLocally(false);
        dismissPushPrompt();
        const hasAdmin = Boolean(getActiveAdminToken());
        lastSyncedSessionKey = `${serialized.endpoint}|${(res.person || resolvedPerson || '').toLowerCase()}|${hasAdmin}`;

        return {
            ok: true,
            isAdmin: res.isAdmin,
            person: res.person,
            message: 'Push alerts enabled on this device!',
        };
    } catch (err) {
        return {
            ok: false,
            reason: 'SUBSCRIBE_FAILED',
            message:
                err instanceof Error
                    ? err.message
                    : 'Could not enable push notifications.',
        };
    }
}

export async function disablePushNotifications(params?: {
    markPaused?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
    const shouldMarkPaused = params?.markPaused ?? true;
    if (shouldMarkPaused) {
        setPushPausedLocally(true);
    }
    lastSyncedSessionKey = null;

    if (!isPushSupported()) {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            await unsubscribePushApi().catch(() => {});
        }
        return { ok: true };
    }

    try {
        const reg = await navigator.serviceWorker.getRegistration();
        const existingSub = reg ? await reg.pushManager.getSubscription() : null;
        const endpoint = existingSub?.endpoint || '';

        if (existingSub) {
            await existingSub.unsubscribe().catch(() => {});
        }

        if (typeof navigator === 'undefined' || navigator.onLine) {
            await unsubscribePushApi(endpoint);
        }

        return { ok: true };
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : 'Failed to pause notifications',
        };
    }
}

/**
 * Silently ensures an already-granted browser push subscription is synced with
 * the backend (updating person association or admin elevation without prompting).
 */
export async function syncExistingPushSubscription(params?: {
    person?: string | null;
    force?: boolean;
}): Promise<boolean> {
    if (!isPushSupported()) return false;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
    if (Notification.permission !== 'granted') return false;
    if (isPushPausedLocally()) return false;

    if (syncInFlightPromise) {
        return syncInFlightPromise;
    }

    syncInFlightPromise = (async () => {
        try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (!registration) return false;

            const resolvedPerson = (params?.person ?? getStoredClaimedPerson() ?? '').trim();
            const hasAdmin = Boolean(getActiveAdminToken());

            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                const config = await getVapidPublicKeyApi().catch(() => null);
                if (!config?.configured || !config.publicKey) {
                    return false;
                }
                const expectedKey = urlBase64ToUint8Array(config.publicKey);
                subscription = await registration.pushManager
                    .subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: expectedKey,
                    })
                    .catch(() => null);
            }

            if (!subscription) return false;

            const serialized = serializePushSubscription(subscription);
            if (!serialized) return false;

            const sessionKey = `${serialized.endpoint}|${resolvedPerson.toLowerCase()}|${hasAdmin}`;
            if (!params?.force && lastSyncedSessionKey === sessionKey) {
                return true;
            }

            await subscribePushApi({
                subscription: serialized,
                person: resolvedPerson,
            });
            lastSyncedSessionKey = sessionKey;
            return true;
        } catch {
            return false;
        } finally {
            syncInFlightPromise = null;
        }
    })();

    return syncInFlightPromise;
}

export async function sendTestPushNotification(): Promise<{
    ok: boolean;
    message: string;
}> {
    try {
        const res = await sendTestPushApi();
        return {
            ok: res.delivered > 0,
            message: res.message || 'Test alert sent!',
        };
    } catch (err) {
        return {
            ok: false,
            message:
                err instanceof Error ? err.message : 'Failed to send test alert.',
        };
    }
}
