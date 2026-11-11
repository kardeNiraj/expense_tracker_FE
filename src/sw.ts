/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
    cleanupOutdatedCaches,
    createHandlerBoundToURL,
    getCacheKeyForURL,
    precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;

interface ExtendedNotificationOptions extends NotificationOptions {
    renotify?: boolean;
}

interface PushNotificationDataPayload {
    url?: string;
    splitId?: string;
    deviceId?: string | null;
    person?: string;
    type?: string;
    from?: string;
    to?: string;
    amount?: number;
}

interface PushMessagePayload {
    title?: string;
    body?: string;
    tag?: string;
    renotify?: boolean;
    url?: string;
    data?: PushNotificationDataPayload;
}

interface PushSubscriptionChangeEventLike extends ExtendableEvent {
    readonly newSubscription?: PushSubscription | null;
    readonly oldSubscription?: PushSubscription | null;
}

self.addEventListener('install', () => {
    void self.skipWaiting();
});

clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

const baseUrl = import.meta.env.BASE_URL || '/';
const appShellUrl = `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}index.html`;
if (getCacheKeyForURL(appShellUrl)) {
    registerRoute(
        new NavigationRoute(createHandlerBoundToURL(appShellUrl), {
            denylist: [/^\/api/],
        })
    );
}

self.addEventListener('message', (event) => {
    const data = event.data as { type?: string } | undefined;
    if (data?.type === 'SKIP_WAITING') {
        void self.skipWaiting();
    }
});

self.addEventListener('push', (event: PushEvent) => {
    let payload: PushMessagePayload = {};
    if (event.data) {
        try {
            payload = event.data.json() as PushMessagePayload;
        } catch {
            const text = event.data.text();
            payload = { body: text };
        }
    }

    const title = payload.title?.trim() || 'SplitNest';
    const targetUrl = payload.data?.url || payload.url || '/';
    const options: ExtendedNotificationOptions = {
        body: payload.body || 'You have a new update in SplitNest.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: payload.tag || 'splitnest-alert',
        renotify: Boolean(payload.renotify),
        data: {
            ...(payload.data || {}),
            url: targetUrl,
        },
    };

    event.waitUntil(
        (async () => {
            await self.registration.showNotification(title, options);
            const windowClients = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true,
            });
            for (const client of windowClients) {
                client.postMessage({
                    type: 'PUSH_RECEIVED',
                    payload: {
                        ...payload,
                        data: {
                            ...(payload.data || {}),
                            url: targetUrl,
                        },
                    },
                });
            }
        })()
    );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
    event.notification.close();

    const data = (event.notification.data || {}) as PushNotificationDataPayload;
    const rawUrl = data.url || '/';
    const resolvedUrl = new URL(rawUrl, self.location.origin);

    event.waitUntil(
        (async () => {
            const windowClients = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true,
            });

            const sameOriginClients = windowClients.filter((client) =>
                client.url.startsWith(self.location.origin)
            );
            const targetClient =
                sameOriginClients.find((client) => client.focused) || sameOriginClients[0];

            if (targetClient) {
                if ('focus' in targetClient) {
                    await targetClient.focus().catch(() => {});
                }
                targetClient.postMessage({
                    type: 'NAVIGATE_TO',
                    url: `${resolvedUrl.pathname}${resolvedUrl.search}`,
                    splitId:
                        data.splitId || resolvedUrl.searchParams.get('splitId') || null,
                    notificationType: data.type || null,
                });
                return;
            }

            if (self.clients.openWindow) {
                await self.clients.openWindow(resolvedUrl.href);
            }
        })()
    );
});

(self as unknown as EventTarget).addEventListener('pushsubscriptionchange', (rawEvent: Event) => {
    const event = rawEvent as PushSubscriptionChangeEventLike;
    event.waitUntil(
        (async () => {
            let latestSub = event.newSubscription ?? null;
            if (!latestSub && event.oldSubscription?.options?.applicationServerKey) {
                try {
                    latestSub = await self.registration.pushManager.subscribe(
                        event.oldSubscription.options
                    );
                } catch {
                    latestSub = null;
                }
            }

            const windowClients = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true,
            });
            for (const client of windowClients) {
                client.postMessage({
                    type: 'PUSH_SUBSCRIPTION_CHANGED',
                    subscription: latestSub ? latestSub.toJSON() : null,
                });
            }
        })()
    );
});

