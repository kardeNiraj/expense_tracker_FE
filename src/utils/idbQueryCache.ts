import type { QueryClient } from '@tanstack/react-query';

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
                    queryClient.setQueryData(parsedKey, record.data, {
                        updatedAt: record.updatedAt,
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
 * Sets up two-way persistence: restores cache from IndexedDB on startup
 * and automatically saves any fresh query data to IndexedDB.
 */
export async function setupQueryCachePersistence(queryClient: QueryClient): Promise<void> {
    // 1. Initial restore from disk
    await restoreQueryCacheFromIdb(queryClient);

    // 2. Subscribe to query cache changes to persist new data
    queryClient.getQueryCache().subscribe((event) => {
        if (event.type === 'updated' && event.action.type === 'success') {
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

