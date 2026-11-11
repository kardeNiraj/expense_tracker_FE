import type { QueryClient } from '@tanstack/react-query';
import { getOfflineQueue } from './offlineQueue';
import {
    applySplitAddToCaches,
    applySplitRemoveToCaches,
    applySplitTransformToCaches,
    withSettlementStatus,
    withUpdatedSplitFields,
} from './splitCacheHelpers';
import type {
    AddSplitPayload,
    AddExpensePayload,
    SettleParticipantPayload,
    AddContributionPayload,
    UpdateSplitPayload,
    SpendingsData,
    ExpenseRecord,
} from '../api/types';

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

function isAnalyticsQueryKeyStr(key: string): boolean {
    if (key.startsWith('["analytics"')) return true;
    try {
        const parsed = JSON.parse(key);
        return Array.isArray(parsed) && parsed[0] === 'analytics';
    } catch {
        return false;
    }
}

function scheduleIdleTask(fn: () => void): void {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => fn(), { timeout: 1500 });
        return;
    }
    setTimeout(fn, 50);
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

async function loadAllQueryKeysFromIdb(): Promise<string[]> {
    try {
        const db = await getDb();
        if (!db) return [];

        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAllKeys();

            request.onsuccess = () => {
                const rawKeys = (request.result as unknown[]) || [];
                resolve(rawKeys.filter((k): k is string => typeof k === 'string'));
            };

            request.onerror = () => {
                resolve([]);
            };
        });
    } catch {
        return [];
    }
}

async function loadRecordsByKeysFromIdb(keys: string[]): Promise<CachedQueryRecord[]> {
    if (keys.length === 0) return [];
    try {
        const db = await getDb();
        if (!db) return [];

        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const records: CachedQueryRecord[] = [];
            let pending = keys.length;

            const finish = () => {
                pending--;
                if (pending <= 0) {
                    resolve(records);
                }
            };

            for (const key of keys) {
                const req = store.get(key);
                req.onsuccess = () => {
                    if (req.result) {
                        records.push(req.result as CachedQueryRecord);
                    }
                    finish();
                };
                req.onerror = () => {
                    finish();
                };
            }
        });
    } catch {
        return [];
    }
}

function buildPendingSplitSettlements(p: AddSplitPayload) {
    if (p.splitMode === 'CUSTOM' && p.customShares && p.customShares.length > 0) {
        const shareMap = new Map(p.customShares.map((cs) => [cs.person.toLowerCase(), cs.share]));
        return (p.participants || [])
            .filter((debtor) => debtor.toLowerCase() !== p.paidBy.toLowerCase())
            .map((debtor) => ({
                from: debtor,
                to: p.paidBy,
                amount: shareMap.get(debtor.toLowerCase()) || 0,
                status: 'PENDING' as const,
            }))
            .filter((s) => s.amount > 0);
    }

    const count = p.participants?.length || 1;
    const perPerson = Math.round((p.amount / count) * 100) / 100;
    return (p.participants || [])
        .filter((debtor) => debtor.toLowerCase() !== p.paidBy.toLowerCase())
        .map((debtor) => ({
            from: debtor,
            to: p.paidBy,
            amount: perPerson,
            status: 'PENDING' as const,
        }));
}

/**
 * Rehydrates any pending offline mutations from localStorage directly into QueryClient memory.
 * This guarantees user transactions are NEVER wiped from view on reload/cold-start.
 */
export function rehydratePendingOfflineData(queryClient: QueryClient): void {
    try {
        const queue = getOfflineQueue();
        if (queue.length === 0) return;

        // 1. Rehydrate ADD_SPLIT items into splits and spendings queries
        const pendingSplitItems = queue.filter((it) => it.type === 'ADD_SPLIT');
        if (pendingSplitItems.length > 0) {
            for (const it of pendingSplitItems) {
                const p = it.payload as AddSplitPayload;
                const splitId = p.splitId || it.splitId || it.id;
                applySplitAddToCaches(queryClient, {
                    splitId,
                    description: p.description,
                    category: p.category,
                    totalAmount: p.amount,
                    paidBy: p.paidBy,
                    createdBy: p.createdBy,
                    participants: p.participants,
                    contributions: p.contributions || [],
                    settlements: buildPendingSplitSettlements(p),
                    status: 'ACTIVE',
                    timestamp: p.timestamp || new Date(it.timestamp).toISOString(),
                });
            }

            for (const it of pendingSplitItems) {
                const p = it.payload as AddSplitPayload;
                if (!p.recordExpense || !p.paidBy) continue;

                const splitId = p.splitId || it.splitId || it.id;
                const spendingsKey = ['spendings', p.paidBy];
                const prevSpendings = queryClient.getQueryData<SpendingsData>(spendingsKey);
                if (!prevSpendings) continue;

                const splitTag = `(split: ${splitId})`.toLowerCase();
                const existingList = prevSpendings.allExpenses || prevSpendings.recentExpenses || [];
                const alreadyExists = existingList.some(
                    (e) => e.description?.toLowerCase().includes(splitTag)
                );

                if (!alreadyExists) {
                    const splitRecord: ExpenseRecord = {
                        category: p.category,
                        amount: p.amount,
                        description: `${p.description} (Split: ${splitId})`,
                        timestamp: p.timestamp || new Date(it.timestamp).toISOString(),
                        isSplitRow: true,
                    };
                    queryClient.setQueryData<SpendingsData>(spendingsKey, {
                        ...prevSpendings,
                        today: prevSpendings.today + p.amount,
                        currentMonth: prevSpendings.currentMonth + p.amount,
                        total: prevSpendings.total + p.amount,
                        ...(typeof prevSpendings.splitRecordedTotal === 'number'
                            ? { splitRecordedTotal: prevSpendings.splitRecordedTotal + p.amount }
                            : {}),
                        todayExpensesCount: prevSpendings.todayExpensesCount + 1,
                        totalExpensesCount: prevSpendings.totalExpensesCount + 1,
                        recentExpenses: [splitRecord, ...(prevSpendings.recentExpenses || [])],
                        ...(prevSpendings.allExpenses
                            ? { allExpenses: [splitRecord, ...prevSpendings.allExpenses] }
                            : {}),
                    });
                }
            }
        }

        // 2. Rehydrate ADD_EXPENSE items into spendings queries
        const pendingExpenseItems = queue.filter((it) => it.type === 'ADD_EXPENSE');
        for (const it of pendingExpenseItems) {
            const p = it.payload as AddExpensePayload;
            const spendingsKey = ['spendings', p.payee];
            const prevSpendings = queryClient.getQueryData<SpendingsData>(spendingsKey);
            if (prevSpendings) {
                const expTimestamp = p.timestamp || new Date(it.timestamp).toISOString();
                const existingList = prevSpendings.allExpenses || prevSpendings.recentExpenses || [];
                const alreadyExists = existingList.some((e) => {
                    if (e.isSplitRow) return false;
                    if (p.timestamp && e.timestamp) {
                        return e.timestamp === p.timestamp && e.amount === p.amount;
                    }
                    return e.description === p.description && e.amount === p.amount;
                });
                if (!alreadyExists) {
                    const newRecord: ExpenseRecord = {
                        category: p.category,
                        amount: p.amount,
                        description: p.description,
                        timestamp: expTimestamp,
                        isSplitRow: false,
                    };
                    queryClient.setQueryData<SpendingsData>(spendingsKey, {
                        ...prevSpendings,
                        today: prevSpendings.today + p.amount,
                        currentMonth: prevSpendings.currentMonth + p.amount,
                        total: prevSpendings.total + p.amount,
                        ...(typeof prevSpendings.directToday === 'number'
                            ? { directToday: prevSpendings.directToday + p.amount }
                            : {}),
                        ...(typeof prevSpendings.directCurrentMonth === 'number'
                            ? { directCurrentMonth: prevSpendings.directCurrentMonth + p.amount }
                            : {}),
                        ...(typeof prevSpendings.directTotal === 'number'
                            ? { directTotal: prevSpendings.directTotal + p.amount }
                            : {}),
                        ...(typeof prevSpendings.directExpensesCount === 'number'
                            ? { directExpensesCount: prevSpendings.directExpensesCount + 1 }
                            : {}),
                        todayExpensesCount: prevSpendings.todayExpensesCount + 1,
                        totalExpensesCount: prevSpendings.totalExpensesCount + 1,
                        recentExpenses: [newRecord, ...(prevSpendings.recentExpenses || [])],
                        ...(prevSpendings.allExpenses
                            ? { allExpenses: [newRecord, ...prevSpendings.allExpenses] }
                            : {}),
                    });
                }
            }
        }

        // 3. Rehydrate UPDATE_SPLIT items
        const pendingUpdateItems = queue.filter((it) => it.type === 'UPDATE_SPLIT');
        for (const it of pendingUpdateItems) {
            const p = it.payload as UpdateSplitPayload;
            applySplitTransformToCaches(queryClient, p.splitId, (s) =>
                withUpdatedSplitFields(s, p)
            );
        }

        // 4. Rehydrate ADD_CONTRIBUTION items
        const pendingContribItems = queue.filter((it) => it.type === 'ADD_CONTRIBUTION');
        for (const it of pendingContribItems) {
            const p = it.payload as AddContributionPayload;
            applySplitTransformToCaches(queryClient, p.splitId, (s) => {
                const alreadyExists = (s.contributions || []).some(
                    (c) => c.person === p.person && c.amount === p.amount
                );
                if (alreadyExists) return s;
                return {
                    ...s,
                    contributions: [...(s.contributions || []), { person: p.person, amount: p.amount }],
                };
            });
        }

        // 5. Rehydrate SETTLE_PARTICIPANT items
        const pendingSettleItems = queue.filter((it) => it.type === 'SETTLE_PARTICIPANT');
        for (const it of pendingSettleItems) {
            const p = it.payload as SettleParticipantPayload;
            applySplitTransformToCaches(queryClient, p.splitId, (s) =>
                withSettlementStatus(s, p.from, p.to, p.settled !== false)
            );
        }

        // 6. Rehydrate DELETE_SPLIT items (filter out deleted splits & any linked split spend row)
        const pendingDeleteItems = queue.filter((it) => it.type === 'DELETE_SPLIT');
        for (const it of pendingDeleteItems) {
            const p = it.payload as { splitId: string };
            applySplitRemoveToCaches(queryClient, p.splitId);

            const splitTag = `(split: ${p.splitId})`.toLowerCase();
            queryClient.setQueriesData<SpendingsData>({ queryKey: ['spendings'] }, (old) => {
                if (!old) return old;
                const matchedRow = (old.allExpenses || old.recentExpenses || []).find((e) =>
                    e.description?.toLowerCase().includes(splitTag)
                );
                if (!matchedRow) return old;

                return {
                    ...old,
                    today: Math.max(0, old.today - matchedRow.amount),
                    currentMonth: Math.max(0, old.currentMonth - matchedRow.amount),
                    total: Math.max(0, old.total - matchedRow.amount),
                    ...(typeof old.splitRecordedTotal === 'number'
                        ? { splitRecordedTotal: Math.max(0, old.splitRecordedTotal - matchedRow.amount) }
                        : {}),
                    todayExpensesCount: Math.max(0, (old.todayExpensesCount || 1) - 1),
                    totalExpensesCount: Math.max(0, (old.totalExpensesCount || 1) - 1),
                    recentExpenses: (old.recentExpenses || []).filter(
                        (e) => !e.description?.toLowerCase().includes(splitTag)
                    ),
                    ...(old.allExpenses
                        ? {
                              allExpenses: old.allExpenses.filter(
                                  (e) => !e.description?.toLowerCase().includes(splitTag)
                              ),
                          }
                        : {}),
                };
            });
        }
    } catch (err) {
        console.warn('[IndexedDB] Error rehydrating pending offline data:', err);
    }
}

function applyRecordsToQueryClient(
    queryClient: QueryClient,
    records: CachedQueryRecord[],
    skipIfDefined = false
): number {
    let restoredCount = 0;

    for (const record of records) {
        try {
            const parsedKey = JSON.parse(record.key);
            if (record.data !== undefined) {
                if (skipIfDefined && queryClient.getQueryData(parsedKey) !== undefined) {
                    continue;
                }
                // Preserve genuine persistence age so offline data renders immediately
                // while online restarts still refresh stale records from the server.
                const restoredUpdatedAt = record.updatedAt
                    ? Math.min(record.updatedAt, Date.now())
                    : 0;
                queryClient.setQueryData(parsedKey, record.data, {
                    updatedAt: restoredUpdatedAt,
                });
                restoredCount++;
            }
        } catch {
            // Ignore malformed query key
        }
    }

    return restoredCount;
}

export interface RestoreQueryCacheOptions {
    deferAnalytics?: boolean;
}

/**
 * Restores cached queries from IndexedDB into QueryClient memory cache.
 * When `deferAnalytics` is true, heavy analytics payloads are restored lazily after mount
 * so iOS PWA cold startup does not block on structured-cloning historical charts.
 */
export async function restoreQueryCacheFromIdb(
    queryClient: QueryClient,
    options?: RestoreQueryCacheOptions
): Promise<number> {
    try {
        if (!options?.deferAnalytics) {
            const records = await loadAllQueriesFromIdb();
            return applyRecordsToQueryClient(queryClient, records, false);
        }

        const allKeys = await loadAllQueryKeysFromIdb();
        if (allKeys.length === 0) return 0;

        const criticalKeys: string[] = [];
        const analyticsKeys: string[] = [];
        for (const key of allKeys) {
            if (isAnalyticsQueryKeyStr(key)) {
                analyticsKeys.push(key);
            } else {
                criticalKeys.push(key);
            }
        }

        const criticalRecords = await loadRecordsByKeysFromIdb(criticalKeys);
        const restoredCount = applyRecordsToQueryClient(queryClient, criticalRecords, false);

        if (analyticsKeys.length > 0) {
            scheduleIdleTask(() => {
                void loadRecordsByKeysFromIdb(analyticsKeys).then((analyticsRecords) => {
                    applyRecordsToQueryClient(queryClient, analyticsRecords, true);
                });
            });
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
export async function setupQueryCachePersistence(
    queryClient: QueryClient,
    options?: RestoreQueryCacheOptions
): Promise<void> {
    // 1. Initial restore from disk (staged when analytics tab is not initially active)
    await restoreQueryCacheFromIdb(queryClient, options);

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
                // Don't persist volatile health checks, device auth, notification status, or admin caches
                const keyStr = JSON.stringify(query.queryKey);
                if (
                    !keyStr.includes('"health"') &&
                    !keyStr.includes('"admin"') &&
                    !keyStr.includes('"notifications"') &&
                    !keyStr.includes('"device"')
                ) {
                    persistQueryToIdb(keyStr, query.state.data);
                }
            }
        }
    });
}

