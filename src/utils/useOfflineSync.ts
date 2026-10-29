import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    getOfflineQueue,
    getGroupedOfflineQueue,
    subscribeToOfflineQueue,
    processOfflineQueue,
    retryGroupNow as retryGroupAction,
    discardGroup as discardGroupAction,
    clearOfflineQueue,
    type SyncResult,
    type QueuedItem,
    type QueuedGroup,
} from './offlineQueue';
import { useExpense } from '../context';
import { triggerHaptic } from './haptics';

export function useOfflineSync() {
    const queryClient = useQueryClient();
    const { showToast } = useExpense();

    const [isOnline, setIsOnline] = useState<boolean>(() =>
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );
    const [queue, setQueue] = useState<QueuedItem[]>(() => getOfflineQueue());
    const [groups, setGroups] = useState<QueuedGroup[]>(() => getGroupedOfflineQueue());
    const [isSyncing, setIsSyncing] = useState<boolean>(false);

    const pendingCount = queue.length;
    const hasBackoff = groups.some((g) => g.isInBackoff);

    // Sync queue to backend
    const syncNow = useCallback(async (): Promise<SyncResult | null> => {
        if (isSyncing || typeof navigator === 'undefined' || !navigator.onLine) {
            return null;
        }

        const count = getOfflineQueue().length;
        if (count === 0) return null;

        setIsSyncing(true);
        triggerHaptic('light');

        try {
            const result = await processOfflineQueue(queryClient);
            if (result.processed > 0) {
                triggerHaptic('success');
                showToast(
                    `Synced ${result.processed} pending ${result.processed === 1 ? 'record' : 'records'} to cloud!`,
                    'cloud_done'
                );
            }
            return result;
        } catch (err) {
            console.error('Offline sync failed', err);
            return null;
        } finally {
            setIsSyncing(false);
            const freshQueue = getOfflineQueue();
            setQueue(freshQueue);
            setGroups(getGroupedOfflineQueue());
        }
    }, [isSyncing, queryClient, showToast]);

    const retryGroup = useCallback(
        async (groupId: string): Promise<SyncResult | null> => {
            if (isSyncing || typeof navigator === 'undefined' || !navigator.onLine) {
                return null;
            }
            setIsSyncing(true);
            triggerHaptic('medium');
            try {
                const result = await retryGroupAction(groupId, queryClient);
                return result;
            } finally {
                setIsSyncing(false);
                setQueue(getOfflineQueue());
                setGroups(getGroupedOfflineQueue());
            }
        },
        [isSyncing, queryClient]
    );

    const discardGroup = useCallback((groupId: string) => {
        triggerHaptic('warning');
        discardGroupAction(groupId);
        setQueue(getOfflineQueue());
        setGroups(getGroupedOfflineQueue());
    }, []);

    const clearQueue = useCallback(() => {
        triggerHaptic('warning');
        clearOfflineQueue();
        setQueue([]);
        setGroups([]);
    }, []);

    // Listen to queue changes and online/offline status
    useEffect(() => {
        const unsubscribe = subscribeToOfflineQueue((updatedQueue) => {
            setQueue(updatedQueue);
            setGroups(getGroupedOfflineQueue());
        });

        const handleOnline = () => {
            setIsOnline(true);
            triggerHaptic('medium');
            showToast('Back online! Syncing pending records...', 'wifi');
            // Give network 500ms to establish socket/TLS before sending requests
            setTimeout(() => {
                syncNow();
            }, 500);
        };

        const handleOffline = () => {
            setIsOnline(false);
            triggerHaptic('warning');
            showToast('You are offline. Transactions will save locally.', 'cloud_off');
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && navigator.onLine) {
                syncNow();
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Periodic tick every 1 second when items are in backoff to refresh countdowns
        const backoffInterval = setInterval(() => {
            const currentQueue = getOfflineQueue();
            const now = Date.now();
            if (currentQueue.some((it) => it.nextRetryAt && it.nextRetryAt > now)) {
                setGroups(getGroupedOfflineQueue(now));
            }
        }, 1000);

        // Initial check on mount if items are waiting and online
        let mountTimer: ReturnType<typeof setTimeout> | undefined;
        if (typeof navigator !== 'undefined' && navigator.onLine && getOfflineQueue().length > 0) {
            mountTimer = setTimeout(() => {
                syncNow();
            }, 100);
        }

        return () => {
            if (mountTimer) clearTimeout(mountTimer);
            clearInterval(backoffInterval);
            unsubscribe();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [syncNow, showToast]);

    return {
        isOnline,
        pendingCount,
        queue,
        groups,
        hasBackoff,
        isSyncing,
        syncNow,
        retryGroup,
        discardGroup,
        clearQueue,
    };
}

export default useOfflineSync;
