import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
    getOfflineQueue,
    getGroupedOfflineQueue,
    subscribeToOfflineQueue,
    processOfflineQueue,
    retryGroupNow as retryGroupAction,
    discardGroup as discardGroupAction,
    discardQueuedMutation as discardMutationAction,
    clearOfflineQueue,
    type SyncResult,
    type QueuedItem,
    type QueuedGroup,
} from './offlineQueue';
import { useExpense } from '../context';
import { triggerHaptic } from './haptics';

interface OfflineSyncSnapshot {
    isOnline: boolean;
    queue: QueuedItem[];
    groups: QueuedGroup[];
    hasBackoff: boolean;
    isSyncing: boolean;
}

type ShowToastFn = (message: string, icon?: string) => void;

const storeListeners = new Set<() => void>();

let latestQueryClient: QueryClient | null = null;
let latestShowToast: ShowToastFn | null = null;

let queueUnsubscribe: (() => void) | null = null;
let onlineSyncTimer: ReturnType<typeof setTimeout> | null = null;
let mountSyncTimer: ReturnType<typeof setTimeout> | null = null;
let backoffInterval: ReturnType<typeof setInterval> | null = null;
let listenersAttached = false;
let syncInFlightPromise: Promise<SyncResult | null> | null = null;

function createSnapshot(
    isOnline: boolean,
    isSyncing: boolean,
    now = Date.now()
): OfflineSyncSnapshot {
    const queue = getOfflineQueue();
    const groups = getGroupedOfflineQueue(now);
    const hasBackoff = groups.some((g) => g.isInBackoff);
    return {
        isOnline,
        queue,
        groups,
        hasBackoff,
        isSyncing,
    };
}

let currentSnapshot: OfflineSyncSnapshot = createSnapshot(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
    false
);

const SERVER_SNAPSHOT: OfflineSyncSnapshot = {
    isOnline: true,
    queue: [],
    groups: [],
    hasBackoff: false,
    isSyncing: false,
};

function emitChange(): void {
    storeListeners.forEach((listener) => listener());
}

function updateSnapshot(next: OfflineSyncSnapshot): void {
    currentSnapshot = next;
    emitChange();
}

function syncBackoffTicker(): void {
    const now = Date.now();
    const needsTicker = currentSnapshot.queue.some(
        (it) => Boolean(it.nextRetryAt && it.nextRetryAt > now)
    );

    if (needsTicker && !backoffInterval) {
        backoffInterval = setInterval(() => {
            const tickNow = Date.now();
            const freshQueue = getOfflineQueue();
            const freshGroups = getGroupedOfflineQueue(tickNow);
            const stillHasFutureBackoff = freshQueue.some(
                (it) => Boolean(it.nextRetryAt && it.nextRetryAt > tickNow)
            );
            updateSnapshot({
                isOnline: currentSnapshot.isOnline,
                isSyncing: currentSnapshot.isSyncing,
                queue: freshQueue,
                groups: freshGroups,
                hasBackoff: freshGroups.some((g) => g.isInBackoff),
            });
            if (!stillHasFutureBackoff && backoffInterval) {
                clearInterval(backoffInterval);
                backoffInterval = null;
            }
        }, 1000);
    } else if (!needsTicker && backoffInterval) {
        clearInterval(backoffInterval);
        backoffInterval = null;
    }
}

function refreshQueueSnapshot(): void {
    const now = Date.now();
    const freshQueue = getOfflineQueue();
    const freshGroups = getGroupedOfflineQueue(now);
    updateSnapshot({
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : currentSnapshot.isOnline,
        isSyncing: currentSnapshot.isSyncing,
        queue: freshQueue,
        groups: freshGroups,
        hasBackoff: freshGroups.some((g) => g.isInBackoff),
    });
    syncBackoffTicker();
}

async function runSyncNow(
    queryClientArg?: QueryClient,
    showToastArg?: ShowToastFn
): Promise<SyncResult | null> {
    if (typeof navigator === 'undefined' || !navigator.onLine) {
        return null;
    }

    if (syncInFlightPromise) {
        return syncInFlightPromise;
    }

    const count = getOfflineQueue().length;
    if (count === 0) return null;

    const qc = queryClientArg || latestQueryClient || undefined;
    const toast = showToastArg || latestShowToast;

    updateSnapshot({
        ...currentSnapshot,
        isSyncing: true,
    });
    triggerHaptic('light');

    syncInFlightPromise = (async () => {
        try {
            const result = await processOfflineQueue(qc);
            if (result.processed > 0) {
                triggerHaptic('success');
                toast?.(
                    `Synced ${result.processed} pending ${result.processed === 1 ? 'record' : 'records'} to cloud!`,
                    'cloud_done'
                );
            }
            return result;
        } catch (err) {
            console.error('Offline sync failed', err);
            return null;
        } finally {
            syncInFlightPromise = null;
            const now = Date.now();
            const freshQueue = getOfflineQueue();
            const freshGroups = getGroupedOfflineQueue(now);
            updateSnapshot({
                isOnline: typeof navigator !== 'undefined' ? navigator.onLine : currentSnapshot.isOnline,
                isSyncing: false,
                queue: freshQueue,
                groups: freshGroups,
                hasBackoff: freshGroups.some((g) => g.isInBackoff),
            });
            syncBackoffTicker();
        }
    })();

    return syncInFlightPromise;
}

const handleOnline = () => {
    updateSnapshot({
        ...currentSnapshot,
        isOnline: true,
    });
    triggerHaptic('medium');
    latestShowToast?.('Back online! Syncing pending records...', 'wifi');
    if (onlineSyncTimer) {
        clearTimeout(onlineSyncTimer);
    }
    // Give network 500ms to establish socket/TLS before sending requests
    onlineSyncTimer = setTimeout(() => {
        onlineSyncTimer = null;
        void runSyncNow();
    }, 500);
};

const handleOffline = () => {
    if (onlineSyncTimer) {
        clearTimeout(onlineSyncTimer);
        onlineSyncTimer = null;
    }
    updateSnapshot({
        ...currentSnapshot,
        isOnline: false,
    });
    triggerHaptic('warning');
    latestShowToast?.('You are offline. Transactions will save locally.', 'cloud_off');
};

const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && navigator.onLine) {
        void runSyncNow();
    }
};

function startStoreListeners(): void {
    if (listenersAttached || typeof window === 'undefined') return;
    listenersAttached = true;

    currentSnapshot = createSnapshot(
        typeof navigator !== 'undefined' ? navigator.onLine : true,
        Boolean(syncInFlightPromise)
    );
    syncBackoffTicker();

    queueUnsubscribe = subscribeToOfflineQueue(() => {
        refreshQueueSnapshot();
    });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    if (typeof navigator !== 'undefined' && navigator.onLine && getOfflineQueue().length > 0) {
        mountSyncTimer = setTimeout(() => {
            mountSyncTimer = null;
            void runSyncNow();
        }, 150);
    }
}

function stopStoreListeners(): void {
    if (!listenersAttached) return;
    listenersAttached = false;

    if (onlineSyncTimer) {
        clearTimeout(onlineSyncTimer);
        onlineSyncTimer = null;
    }
    if (mountSyncTimer) {
        clearTimeout(mountSyncTimer);
        mountSyncTimer = null;
    }
    if (backoffInterval) {
        clearInterval(backoffInterval);
        backoffInterval = null;
    }
    if (queueUnsubscribe) {
        queueUnsubscribe();
        queueUnsubscribe = null;
    }
    if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    }
    if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
}

function subscribeStore(listener: () => void): () => void {
    storeListeners.add(listener);
    if (storeListeners.size === 1) {
        startStoreListeners();
    }
    return () => {
        storeListeners.delete(listener);
        if (storeListeners.size === 0) {
            stopStoreListeners();
        }
    };
}

function getStoreSnapshot(): OfflineSyncSnapshot {
    return currentSnapshot;
}

function getServerSnapshot(): OfflineSyncSnapshot {
    return SERVER_SNAPSHOT;
}

export function useOfflineSync() {
    const queryClient = useQueryClient();
    const { showToast } = useExpense();

    useEffect(() => {
        latestQueryClient = queryClient;
        latestShowToast = showToast;
    }, [queryClient, showToast]);

    const snapshot = useSyncExternalStore(
        subscribeStore,
        getStoreSnapshot,
        getServerSnapshot
    );

    const syncNow = useCallback((): Promise<SyncResult | null> => {
        return runSyncNow(queryClient, showToast);
    }, [queryClient, showToast]);

    const retryGroup = useCallback(
        async (groupId: string): Promise<SyncResult | null> => {
            if (syncInFlightPromise || typeof navigator === 'undefined' || !navigator.onLine) {
                return null;
            }
            updateSnapshot({ ...currentSnapshot, isSyncing: true });
            triggerHaptic('medium');
            try {
                const result = await retryGroupAction(groupId, queryClient);
                return result;
            } finally {
                const now = Date.now();
                const freshQueue = getOfflineQueue();
                const freshGroups = getGroupedOfflineQueue(now);
                updateSnapshot({
                    isOnline: currentSnapshot.isOnline,
                    isSyncing: false,
                    queue: freshQueue,
                    groups: freshGroups,
                    hasBackoff: freshGroups.some((g) => g.isInBackoff),
                });
                syncBackoffTicker();
            }
        },
        [queryClient]
    );

    const discardGroup = useCallback(
        (groupId: string) => {
            triggerHaptic('warning');
            discardGroupAction(groupId, queryClient);
            refreshQueueSnapshot();
            if (typeof navigator !== 'undefined' && navigator.onLine) {
                queryClient.invalidateQueries();
            }
            showToast('Discarded operation and removed from view', 'delete');
        },
        [queryClient, showToast]
    );

    const discardItem = useCallback(
        (itemId: string) => {
            triggerHaptic('warning');
            discardMutationAction(itemId, queryClient);
            refreshQueueSnapshot();
            if (typeof navigator !== 'undefined' && navigator.onLine) {
                queryClient.invalidateQueries();
            }
            showToast('Operation cancelled and removed from view', 'delete');
        },
        [queryClient, showToast]
    );

    const clearQueue = useCallback(() => {
        triggerHaptic('warning');
        clearOfflineQueue(queryClient);
        refreshQueueSnapshot();
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            queryClient.invalidateQueries();
        }
        showToast('All pending operations cleared', 'delete');
    }, [queryClient, showToast]);

    return {
        isOnline: snapshot.isOnline,
        pendingCount: snapshot.queue.length,
        queue: snapshot.queue,
        groups: snapshot.groups,
        hasBackoff: snapshot.hasBackoff,
        isSyncing: snapshot.isSyncing,
        syncNow,
        retryGroup,
        discardGroup,
        discardItem,
        clearQueue,
    };
}

export default useOfflineSync;
