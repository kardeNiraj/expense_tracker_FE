import type { QueryClient } from '@tanstack/react-query';
import { getOfflineQueue } from './offlineQueue';
import type { AddSplitPayload, AddExpensePayload, Split, SpendingsData } from '../api/types';

const DB_NAME = 'splitnest_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'query_cache';

export interface CachedQueryRecord {
    key: string;
    data: unknown;
    updatedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function getDb(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
        return Promise.resolve(null);
    }

    if (!dbPromise) {
        dbPromise = new Promise((resolve) => {
            try {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (event) => {
                    const db = (event.target as IDBOpenDBRequest).result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                    }
                };

                request.onsuccess = () => {
                    resolve(request.result);
                };

                request.onerror = (err) => {
                    console.warn('[IndexedDB] Failed to open database:', err);
                    resolve(null);
                };

                request.onblocked = () => {
                    console.warn('[IndexedDB] Database open blocked');
                    resolve(null);
                };
            } catch (err) {
                console.warn('[IndexedDB] Exception opening database:', err);
                resolve(null);
            }
        });
    }

    return dbPromise;
}

/**
 * Persists a single query result to IndexedDB.
 */
export async function persistQueryToIdb(key: string, data: unknown): Promise<void> {
    try {
        const db = await getDb();
        if (!db) return;

        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const record: CachedQueryRecord = {
            key,
            data,
            updatedAt: Date.now(),
        };

        store.put(record);
    } catch (err) {
        // Silently catch quota or serialization issues without breaking the app
        console.warn('[IndexedDB] Error persisting query:', key, err);
    }
}

/**
 * Loads all cached query records from IndexedDB.
 */
export async function loadAllQueriesFromIdb(): Promise<CachedQueryRecord[]> {
    try {
        const db = await getDb();
        if (!db) return [];

        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve((request.result as CachedQueryRecord[]) || []);
            };

            request.onerror = () => {
                resolve([]);
            };
        });
    } catch {
        return [];
    }
}

/**
 * Rehydrates any pending offline mutations from localStorage directly into QueryClient memory.
 * This guarantees user transactions are NEVER wiped from view on reload/cold-start.
 */
export function rehydratePendingOfflineData(queryClient: QueryClient): void {
    try {
        const queue = getOfflineQueue();
        if (queue.length === 0) return;

        // 1. Rehydrate ADD_SPLIT items into splits queries
        const pendingSplitItems = queue.filter((it) => it.type === 'ADD_SPLIT');
        if (pendingSplitItems.length > 0) {
            queryClient.setQueriesData<Split[]>({ queryKey: ['splits'] }, (old = []) => {
                const existingIds = new Set(old.map((s) => s.splitId));
                const newSplits: Split[] = [];

                for (const it of pendingSplitItems) {
                    const p = it.payload as AddSplitPayload;
                    const splitId = p.splitId || it.splitId || it.id;
                    if (!existingIds.has(splitId)) {
                        const count = p.participants?.length || 1;
                        const perPerson = Math.round((p.amount / count) * 100) / 100;
                        const settlements = (p.participants || [])
                            .filter((debtor) => debtor.toLowerCase() !== p.paidBy.toLowerCase())
                            .map((debtor) => ({
                                from: debtor,
                                to: p.paidBy,
                                amount: perPerson,
                                status: 'PENDING' as const,
                            }));

                        newSplits.push({
                            splitId,
                            description: p.description,
                            category: p.category,
                            totalAmount: p.amount,
                            paidBy: p.paidBy,
                            createdBy: p.createdBy,
                            participants: p.participants,
                            contributions: p.contributions || [],
                            settlements,
                            status: 'ACTIVE',
                            timestamp: new Date(it.timestamp).toISOString(),
                        });
                        existingIds.add(splitId);
                    }
                }

                return newSplits.length > 0 ? [...newSplits, ...old] : old;
            });
        }

        // 2. Rehydrate ADD_EXPENSE items into spendings queries
        const pendingExpenseItems = queue.filter((it) => it.type === 'ADD_EXPENSE');
        for (const it of pendingExpenseItems) {
            const p = it.payload as AddExpensePayload;
            const spendingsKey = ['spendings', p.payee];
            const prevSpendings = queryClient.getQueryData<SpendingsData>(spendingsKey);
            if (prevSpendings) {
                const alreadyExists = prevSpendings.recentExpenses?.some(
                    (e) => e.description === p.description && e.amount === p.amount
                );
                if (!alreadyExists) {
                    queryClient.setQueryData<SpendingsData>(spendingsKey, {
                        ...prevSpendings,
                        today: prevSpendings.today + p.amount,
                        currentMonth: prevSpendings.currentMonth + p.amount,
                        total: prevSpendings.total + p.amount,
                        recentExpenses: [
                            {
                                category: p.category,
                                amount: p.amount,
                                description: p.description,
                                timestamp: new Date(it.timestamp).toISOString(),
                            },
                            ...prevSpendings.recentExpenses,
                        ],
                    });
                }
            }
        }
    } catch (err) {
        console.warn('[IndexedDB] Error rehydrating pending offline data:', err);
    }
}

/**
 * Restores all cached queries from IndexedDB into the QueryClient memory cache.
 */
export async function restoreQueryCacheFromIdb(queryClient: QueryClient): Promise<number> {
    try {
        const records = await loadAllQueriesFromIdb();
        let restoredCount = 0;

        for (const record of records) {
            try {
                const parsedKey = JSON.parse(record.key);
                if (record.data !== undefined) {
                    // Touch updatedAt to prevent immediate stale-wiping on cold start
                    const safeUpdatedAt = Math.max(record.updatedAt || 0, Date.now() - 30000);
                    queryClient.setQueryData(parsedKey, record.data, {
                        updatedAt: safeUpdatedAt,
                    });
                    restoredCount++;
                }
            } catch {
                // Ignore malformed query key
            }
        }

        return restoredCount;
    } catch (err) {
        console.warn('[IndexedDB] Error restoring query cache:', err);
        return 0;
    }
}

/**
 * Sets up two-way persistence: restores cache from IndexedDB on startup,
 * rehydrates any queued offline transactions, and automatically saves
 * both network-fetched and optimistic query updates to IndexedDB.
 */
export async function setupQueryCachePersistence(queryClient: QueryClient): Promise<void> {
    // 1. Initial restore from disk
    await restoreQueryCacheFromIdb(queryClient);

    // 2. Rehydrate any offline pending items from storage
    rehydratePendingOfflineData(queryClient);

    // 3. Subscribe to query cache changes to persist new data (both success and optimistic setQueryData)
    queryClient.getQueryCache().subscribe((event) => {
        if (
            event.type === 'updated' &&
            (event.action.type === 'success' || event.action.type === 'setState')
        ) {
            const query = event.query;
            if (query.state.data !== undefined) {
                // Don't persist volatile health checks or temporary error states
                const keyStr = JSON.stringify(query.queryKey);
                if (!keyStr.includes('"health"')) {
                    persistQueryToIdb(keyStr, query.state.data);
                }
            }
        }
    });
}

