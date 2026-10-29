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

export type QueuedItemStatus = 'PENDING' | 'SYNCING' | 'FAILED';

export interface QueuedItem<T = unknown> {
    id: string;
    type: QueuedMutationType;
    payload: T;
    timestamp: number;
    retryCount: number;
    lastError?: string;
    nextRetryAt?: number; // timestamp in ms when item is eligible to retry
    status?: QueuedItemStatus;
    splitId?: string; // Canonical group key for split operations
}

export interface QueuedGroup {
    groupId: string;
    splitId?: string;
    type: 'SPLIT' | 'EXPENSE' | 'UPI';
    title: string;
    description?: string;
    amount?: number;
    paidBy?: string;
    items: QueuedItem[];
    isInBackoff: boolean;
    nextRetryAt?: number;
    backoffSecondsRemaining?: number;
    lastError?: string;
    status: 'PENDING' | 'SYNCING' | 'BACKOFF' | 'FAILED';
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
 * Updates a specific queued mutation in storage.
 */
export function updateQueuedItem(id: string, updates: Partial<QueuedItem>): void {
    const queue = getOfflineQueue().map((item) => {
        if (item.id === id) {
            return { ...item, ...updates };
        }
        return item;
    });
    saveOfflineQueue(queue);
}

/**
 * Enqueues a new mutation into the offline sync queue.
 * Extracts `splitId` when available so operations on the same split are grouped.
 */
export function enqueueOfflineMutation<T>(
    type: QueuedMutationType,
    payload: T
): QueuedItem<T> {
    const queue = getOfflineQueue();

    let splitId: string | undefined;
    if (type === 'ADD_SPLIT') {
        splitId = (payload as AddSplitPayload)?.splitId;
    } else if (type === 'SETTLE_PARTICIPANT') {
        splitId = (payload as SettleParticipantPayload)?.splitId;
    } else if (type === 'ADD_CONTRIBUTION') {
        splitId = (payload as AddContributionPayload)?.splitId;
    }

    const item: QueuedItem<T> = {
        id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type,
        payload,
        timestamp: Date.now(),
        retryCount: 0,
        status: 'PENDING',
        splitId,
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
 * Discards an entire split group or standalone transaction from the queue.
 */
export function discardGroup(groupId: string): void {
    const queue = getOfflineQueue().filter((item) => {
        const itemGroupId = item.splitId || `item_${item.id}`;
        return itemGroupId !== groupId;
    });
    saveOfflineQueue(queue);
}

/**
 * Clears the entire offline queue.
 */
export function clearOfflineQueue(): void {
    saveOfflineQueue([]);
}

/**
 * Groups raw queued items by splitId (preserving FIFO ordering per split)
 * and computes live backoff countdowns.
 */
export function getGroupedOfflineQueue(now: number = Date.now()): QueuedGroup[] {
    const queue = getOfflineQueue();
    const groupsMap = new Map<string, QueuedGroup>();

    for (const item of queue) {
        const groupId = item.splitId || `item_${item.id}`;
        let group = groupsMap.get(groupId);

        if (!group) {
            let title = 'Pending Operation';
            let description: string | undefined;
            let amount: number | undefined;
            let paidBy: string | undefined;
            let type: 'SPLIT' | 'EXPENSE' | 'UPI' = 'SPLIT';

            if (item.type === 'ADD_SPLIT') {
                const p = item.payload as AddSplitPayload;
                title = p.description || 'New Split';
                description = `Split between ${p.participants?.length || 0} people`;
                amount = p.amount;
                paidBy = p.paidBy;
                type = 'SPLIT';
            } else if (item.type === 'SETTLE_PARTICIPANT') {
                const p = item.payload as SettleParticipantPayload;
                title = `Settle: ${p.from} → ${p.to || 'Creditor'}`;
                type = 'SPLIT';
            } else if (item.type === 'ADD_CONTRIBUTION') {
                const p = item.payload as AddContributionPayload;
                title = `Contribution from ${p.person}`;
                amount = p.amount;
                type = 'SPLIT';
            } else if (item.type === 'ADD_EXPENSE') {
                const p = item.payload as AddExpensePayload;
                title = p.description || 'Personal Expense';
                amount = p.amount;
                paidBy = p.payee;
                type = 'EXPENSE';
            } else if (item.type === 'UPDATE_UPI') {
                const p = item.payload as UpdateUpiPayload;
                title = `Update UPI (${p.name})`;
                description = p.upiId;
                type = 'UPI';
            }

            group = {
                groupId,
                splitId: item.splitId,
                type,
                title,
                description,
                amount,
                paidBy,
                items: [],
                isInBackoff: false,
                status: 'PENDING',
            };
            groupsMap.set(groupId, group);
        } else {
            if (item.type === 'ADD_SPLIT') {
                const p = item.payload as AddSplitPayload;
                group.title = p.description || group.title;
                group.amount = p.amount ?? group.amount;
                group.paidBy = p.paidBy ?? group.paidBy;
            }
        }

        group.items.push(item);
    }

    // Compute status and backoff for each group
    for (const group of groupsMap.values()) {
        const isSyncing = group.items.some((it) => it.status === 'SYNCING');
        const firstItem = group.items[0];
        const hasBackoff = Boolean(firstItem?.nextRetryAt && now < firstItem.nextRetryAt);

        group.isInBackoff = hasBackoff;
        group.nextRetryAt = firstItem?.nextRetryAt;
        group.lastError = firstItem?.lastError;

        if (hasBackoff && firstItem.nextRetryAt) {
            group.backoffSecondsRemaining = Math.max(1, Math.ceil((firstItem.nextRetryAt - now) / 1000));
            group.status = 'BACKOFF';
        } else if (isSyncing) {
            group.status = 'SYNCING';
        } else if (group.items.some((it) => it.status === 'FAILED')) {
            group.status = 'FAILED';
        } else {
            group.status = 'PENDING';
        }
    }

    return Array.from(groupsMap.values());
}

/**
 * Subscribes to changes in the offline queue (e.g. for badges and sync indicators).
 */
export function subscribeToOfflineQueue(listener: QueueListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

let isProcessing = false;
let autoRetryTimer: ReturnType<typeof setTimeout> | null = null;

function planNextAutoRetry(queryClient?: QueryClient): void {
    if (autoRetryTimer) {
        clearTimeout(autoRetryTimer);
        autoRetryTimer = null;
    }

    if (typeof navigator === 'undefined' || !navigator.onLine) return;

    const queue = getOfflineQueue();
    const now = Date.now();
    let earliestDelay = Infinity;

    for (const item of queue) {
        if (item.nextRetryAt && item.nextRetryAt > now) {
            const delay = item.nextRetryAt - now;
            if (delay < earliestDelay) {
                earliestDelay = delay;
            }
        }
    }

    if (earliestDelay < Infinity) {
        autoRetryTimer = setTimeout(() => {
            processOfflineQueue(queryClient);
        }, earliestDelay + 100);
    }
}

export interface SyncResult {
    processed: number;
    failed: number;
    remaining: number;
}

/**
 * Executes a single queued API operation against the backend.
 */
async function executeSingleMutation(item: QueuedItem): Promise<void> {
    switch (item.type) {
        case 'ADD_EXPENSE': {
            await apiFetch<{ message?: string; status?: string }>('/add-expense', {
                method: 'POST',
                body: JSON.stringify(item.payload as AddExpensePayload),
            });
            break;
        }

        case 'ADD_SPLIT': {
            const res = await apiFetch<Split>('/split', {
                method: 'POST',
                body: JSON.stringify(item.payload as AddSplitPayload),
            });
            const sentId = (item.payload as AddSplitPayload)?.splitId;
            const returnedId = res?.splitId;
            if (returnedId && sentId && sentId !== returnedId) {
                const currentQueue = getOfflineQueue();
                for (const q of currentQueue) {
                    if (q.splitId === sentId) {
                        q.splitId = returnedId;
                    }
                    if (q.type === 'SETTLE_PARTICIPANT' && (q.payload as SettleParticipantPayload).splitId === sentId) {
                        (q.payload as SettleParticipantPayload).splitId = returnedId;
                    }
                    if (q.type === 'ADD_CONTRIBUTION' && (q.payload as AddContributionPayload).splitId === sentId) {
                        (q.payload as AddContributionPayload).splitId = returnedId;
                    }
                }
                saveOfflineQueue(currentQueue);
            }
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
}

/**
 * Processes a single group sequentially (FIFO order per split).
 * If an item in this group fails, exponential backoff is scheduled for this group,
 * but other groups continue processing independently.
 */
async function processSingleGroup(
    groupItems: QueuedItem[],
    onProgress?: (synced: number, total: number) => void
): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < groupItems.length; i++) {
        // Re-read fresh state of the item from queue
        const currentItem = getOfflineQueue().find((q) => q.id === groupItems[i].id);
        if (!currentItem) continue;

        const now = Date.now();
        // Check if this item is currently in exponential backoff
        if (currentItem.nextRetryAt && now < currentItem.nextRetryAt) {
            // Group is in backoff; pause this split's pipeline until nextRetryAt
            break;
        }

        updateQueuedItem(currentItem.id, { status: 'SYNCING' });

        try {
            await executeSingleMutation(currentItem);
            dequeueOfflineMutation(currentItem.id);
            processed++;
            onProgress?.(processed, groupItems.length);
        } catch (err: unknown) {
            failed++;

            if (isOfflineOrNetworkError(err)) {
                updateQueuedItem(currentItem.id, { status: 'PENDING' });
                break;
            }

            const errMsg = String(err).toLowerCase();
            const isNotFound = errMsg.includes('not found') || errMsg.includes('404');
            const retryCount = (currentItem.retryCount || 0) + 1;

            // ONLY drop dependent operations (settle / contribution) if the target split was genuinely not found
            // NEVER drop creation operations (ADD_SPLIT, ADD_EXPENSE) which must be preserved!
            const isCreation = currentItem.type === 'ADD_SPLIT' || currentItem.type === 'ADD_EXPENSE';
            if (!isCreation && isNotFound && retryCount >= 5) {
                console.warn(`[OfflineQueue] Dropping obsolete dependent item ${currentItem.id} (${currentItem.type}): ${String(err)}`);
                dequeueOfflineMutation(currentItem.id);
                break;
            }

            // Exponential backoff with jitter: 1s, 2s, 4s, 8s, 16s, 32s (max 60s)
            const baseDelay = 1000 * Math.pow(2, Math.min(retryCount - 1, 6));
            const jitter = Math.floor(Math.random() * 500);
            const delayMs = Math.min(60000, baseDelay + jitter);
            const nextRetryAt = Date.now() + delayMs;

            updateQueuedItem(currentItem.id, {
                retryCount,
                nextRetryAt,
                lastError: String(err),
                status: 'FAILED',
            });

            // FIFO Guard: Stop processing subsequent items in this split
            break;
        }
    }

    return { processed, failed };
}

/**
 * Synchronizes pending offline mutations grouped by split_id.
 * Maintains strict FIFO order of operations per split while allowing
 * independent splits and expenses to sync concurrently in parallel.
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
    let totalProcessed = 0;
    let totalFailed = 0;

    try {
        // Group items by splitId or individual ID
        const groupsMap = new Map<string, QueuedItem[]>();
        for (const item of initialQueue) {
            const groupId = item.splitId || `item_${item.id}`;
            if (!groupsMap.has(groupId)) {
                groupsMap.set(groupId, []);
            }
            groupsMap.get(groupId)!.push(item);
        }

        // Parallel processing across distinct split groups!
        const results = await Promise.allSettled(
            Array.from(groupsMap.values()).map((groupItems) =>
                processSingleGroup(groupItems, onProgress)
            )
        );

        for (const res of results) {
            if (res.status === 'fulfilled') {
                totalProcessed += res.value.processed;
                totalFailed += res.value.failed;
            }
        }
    } finally {
        isProcessing = false;
        if (totalProcessed > 0 && queryClient) {
            queryClient.invalidateQueries();
        }
        planNextAutoRetry(queryClient);
    }

    return {
        processed: totalProcessed,
        failed: totalFailed,
        remaining: getOfflineQueue().length,
    };
}

/**
 * Resets backoff for a specific group and immediately executes sync.
 */
export async function retryGroupNow(
    groupId: string,
    queryClient?: QueryClient
): Promise<SyncResult> {
    const queue = getOfflineQueue().map((item) => {
        const itemGroupId = item.splitId || `item_${item.id}`;
        if (itemGroupId === groupId) {
            return {
                ...item,
                nextRetryAt: undefined,
                status: 'PENDING' as const,
            };
        }
        return item;
    });
    saveOfflineQueue(queue);
    return processOfflineQueue(queryClient);
}
