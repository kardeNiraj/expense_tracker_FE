import { triggerHaptic } from './haptics';

/**
 * Checks for Service Worker updates, purges CacheStorage if requested,
 * and executes a hard reload of the PWA.
 * 
 * NOTE: This ONLY touches static HTTP asset caches (HTML/JS/CSS bundles).
 * User claims (`claimed_person`, `active_person`) and pending offline operations
 * (`splitnest_offline_queue_v1`) are stored safely in `localStorage` and are NEVER deleted.
 * 
 * @param force If true, purges all CacheStorage entries before reload (only when online).
 */
export async function reloadApp(force: boolean = false): Promise<void> {
    triggerHaptic('medium');

    try {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const reg of registrations) {
                await reg.update().catch(() => {});
                if (reg.waiting) {
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
            }
        }

        // Only purge static asset CacheStorage if force is requested AND the device is online
        // (to prevent clearing offline static bundles if the user is in an airplane or no-network zone)
        const isOnline = typeof navigator === 'undefined' || navigator.onLine;
        if (force && isOnline && 'caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((name) => caches.delete(name)));
        }
    } catch (err) {
        console.error('Failed to update service worker / purge caches before reload:', err);
    }

    // Force a fresh reload from server (bypassing in-memory cache)
    window.location.reload();
}

/**
 * Checks if a new Service Worker deployment is available.
 */
export async function checkForAppUpdates(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) return false;
    try {
        const reg = await navigator.serviceWorker.ready;
        await reg.update();
        return Boolean(reg.waiting || reg.installing);
    } catch {
        return false;
    }
}

