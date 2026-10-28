import { apiFetch } from '../api/client';
import type { QueryClient } from '@tanstack/react-query';
import type {
    AddExpensePayload,
    AddSplitPayload,
    AddContributionPayload,
    SettleParticipantPayload,
    UpdateUpiPayload,
    Split,
} from '../api/types';

export const OFFLINE_QUEUE_STORAGE_KEY = 'splitnest_offline_queue_v1';

export type QueuedMutationType =
    | 'ADD_EXPENSE'
    | 'ADD_SPLIT'
    | 'ADD_CONTRIBUTION'
    | 'SETTLE_PARTICIPANT'
    | 'UPDATE_UPI';

export interface QueuedItem<T = unknown> {
    id: string;
    type: QueuedMutationType;
    payload: T;
    timestamp: number;
    retryCount: number;
    lastError?: string;
}

type QueueListener = (queue: QueuedItem[]) => void;
const listeners = new Set<QueueListener>();

/**
 * Returns true if the device is currently offline or if an error is a network connectivity failure.
 */
export function isOfflineOrNetworkError(error?: unknown): boolean {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return true;
    }
    if (!error) return false;
    const msg = String(error).toLowerCase();
    return (
        error instanceof TypeError ||
        msg.includes('fetch') ||
        msg.includes('network') ||
        msg.includes('abort') ||
        msg.includes('offline') ||
        msg.includes('failed to fetch') ||
        msg.includes('connection refused')
    );
}

/**
 * Reads all queued mutations from localStorage safely.
 */
export function getOfflineQueue(): QueuedItem[] {
    try {
        if (typeof window === 'undefined') return [];
        const raw = localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as QueuedItem[];
    } catch (err) {
        console.error('Failed to read offline queue from localStorage', err);
        return [];
    }
}

/**
 * Writes the queue to localStorage and notifies subscribers.
 */
function saveOfflineQueue(queue: QueuedItem[]): void {
    try {
        if (typeof window === 'undefined') return;
        localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(queue));
        listeners.forEach((fn) => fn(queue));
    } catch (err) {
        console.error('Failed to save offline queue to localStorage', err);
    }
}

/**
 * Enqueues a new mutation into the offline sync queue.
 */
export function enqueueOfflineMutation<T>(
    type: QueuedMutationType,
    payload: T
): QueuedItem<T> {
    const queue = getOfflineQueue();
    const item: QueuedItem<T> = {
        id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type,
        payload,
        timestamp: Date.now(),
        retryCount: 0,
    };

    queue.push(item as QueuedItem);
    saveOfflineQueue(queue);
    return item;
}

/**
 * Removes an item from the offline queue by ID.
 */
export function dequeueOfflineMutation(id: string): void {
    const queue = getOfflineQueue().filter((item) => item.id !== id);
    saveOfflineQueue(queue);
}

/**
 * Clears the entire offline queue.
 */
export function clearOfflineQueue(): void {
    saveOfflineQueue([]);
}

/**
 * Subscribes to changes in the offline queue (e.g. for badges and sync indicators).
 */
export function subscribeToOfflineQueue(listener: QueueListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

let isProcessing = false;

export interface SyncResult {
    processed: number;
    failed: number;
    remaining: number;
}

/**
 * Sequentially flushes and synchronizes all pending offline mutations to the backend.
 */
export async function processOfflineQueue(
    queryClient?: QueryClient,
    onProgress?: (synced: number, total: number) => void
): Promise<SyncResult> {
    if (isProcessing) {
        return { processed: 0, failed: 0, remaining: getOfflineQueue().length };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return { processed: 0, failed: 0, remaining: getOfflineQueue().length };
    }

    isProcessing = true;
    const initialQueue = getOfflineQueue();
    let processedCount = 0;
    let failedCount = 0;

    try {
        for (const item of initialQueue) {
            try {
                switch (item.type) {
                    case 'ADD_EXPENSE': {
                        await apiFetch<{ message?: string; status?: string }>('/add-expense', {
                            method: 'POST',
                            body: JSON.stringify(item.payload as AddExpensePayload),
                        });
                        break;
                    }

                    case 'ADD_SPLIT': {
                        await apiFetch<Split>('/split', {
                            method: 'POST',
                            body: JSON.stringify(item.payload as AddSplitPayload),
                        });
                        break;
                    }

                    case 'ADD_CONTRIBUTION': {
                        const { splitId, person, amount } = item.payload as AddContributionPayload;
                        await apiFetch<Split>(`/split/${splitId}/contributions`, {
                            method: 'POST',
                            body: JSON.stringify({ person, amount }),
                        });
                        break;
                    }

                    case 'SETTLE_PARTICIPANT': {
                        const { splitId, from, to, settled, confirmedBy } = item.payload as SettleParticipantPayload;
                        await apiFetch<Split>(`/split/${splitId}/settle`, {
                            method: 'PATCH',
                            body: JSON.stringify({ from, to, settled, confirmedBy }),
                        });
                        break;
                    }

                    case 'UPDATE_UPI': {
                        await apiFetch<{ message?: string; status?: string }>('/people/upi', {
                            method: 'POST',
                            body: JSON.stringify(item.payload as UpdateUpiPayload),
                        });
                        break;
                    }
                }

                // Successfully synced this item -> remove from queue
                dequeueOfflineMutation(item.id);
                processedCount++;
                onProgress?.(processedCount, initialQueue.length);
            } catch (err: unknown) {
                // If it's a network disconnect during sync, halt the loop and wait for connection again
                if (isOfflineOrNetworkError(err)) {
                    break;
                }

                // If it's a server/validation error (e.g. 400), increment retry count
                failedCount++;
                const updatedQueue = getOfflineQueue().map((q) => {
                    if (q.id === item.id) {
                        return {
                            ...q,
                            retryCount: q.retryCount + 1,
                            lastError: String(err),
                        };
                    }
                    return q;
                });
                saveOfflineQueue(updatedQueue);
            }
        }
    } finally {
        isProcessing = false;
        if (processedCount > 0 && queryClient) {
            queryClient.invalidateQueries();
        }
    }

    return {
        processed: processedCount,
        failed: failedCount,
        remaining: getOfflineQueue().length,
    };
}
