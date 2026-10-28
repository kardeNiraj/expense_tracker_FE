import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    getOfflineQueue,
    subscribeToOfflineQueue,
    processOfflineQueue,
    type SyncResult,
} from './offlineQueue';
import { useExpense } from '../context';
import { triggerHaptic } from './haptics';

export function useOfflineSync() {
    const queryClient = useQueryClient();
    const { showToast } = useExpense();

    const [isOnline, setIsOnline] = useState<boolean>(() =>
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );
    const [pendingCount, setPendingCount] = useState<number>(() =>
        getOfflineQueue().length
    );
    const [isSyncing, setIsSyncing] = useState<boolean>(false);

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
            setPendingCount(getOfflineQueue().length);
        }
    }, [isSyncing, queryClient, showToast]);

    // Listen to queue changes and online/offline status
    useEffect(() => {
        const unsubscribe = subscribeToOfflineQueue((queue) => {
            setPendingCount(queue.length);
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

        // Initial check on mount if items are waiting and online
        let mountTimer: ReturnType<typeof setTimeout> | undefined;
        if (typeof navigator !== 'undefined' && navigator.onLine && getOfflineQueue().length > 0) {
            mountTimer = setTimeout(() => {
                syncNow();
            }, 100);
        }

        return () => {
            if (mountTimer) clearTimeout(mountTimer);
            unsubscribe();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [syncNow, showToast]);

    return {
        isOnline,
        pendingCount,
        isSyncing,
        syncNow,
    };
}

export default useOfflineSync;
