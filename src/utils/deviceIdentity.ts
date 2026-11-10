const DEVICE_ID_STORAGE_KEY = 'splitnest_device_id';
const DEVICE_IDB_NAME = 'splitnest_device_identity_db';
const DEVICE_IDB_STORE = 'device_identity';
const DEVICE_IDB_RECORD_KEY = 'primary';

let cachedMemoryDeviceId: string | null = null;
let activeAdminToken: string | null = null;
let activeAdminTokenExpiresAt = 0;

function generateUuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `dev_${crypto.randomUUID()}`;
    }
    const rand = Math.random().toString(36).slice(2, 10);
    const ts = Date.now().toString(36);
    return `dev_${ts}_${rand}`;
}

function openIdentityDb(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
        return Promise.resolve(null);
    }
    return new Promise((resolve) => {
        try {
            const req = indexedDB.open(DEVICE_IDB_NAME, 1);
            req.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(DEVICE_IDB_STORE)) {
                    db.createObjectStore(DEVICE_IDB_STORE, { keyPath: 'key' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
            req.onblocked = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
}

async function readDeviceIdFromIdb(): Promise<string | null> {
    try {
        const db = await openIdentityDb();
        if (!db) return null;
        return await new Promise((resolve) => {
            const tx = db.transaction(DEVICE_IDB_STORE, 'readonly');
            const store = tx.objectStore(DEVICE_IDB_STORE);
            const req = store.get(DEVICE_IDB_RECORD_KEY);
            req.onsuccess = () => {
                const val = req.result as { key: string; deviceId?: string } | undefined;
                resolve(val?.deviceId || null);
            };
            req.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

async function writeDeviceIdToIdb(deviceId: string): Promise<void> {
    try {
        const db = await openIdentityDb();
        if (!db) return;
        const tx = db.transaction(DEVICE_IDB_STORE, 'readwrite');
        tx.objectStore(DEVICE_IDB_STORE).put({ key: DEVICE_IDB_RECORD_KEY, deviceId });
    } catch {
        // Ignore IDB write failure gracefully
    }
}

/**
 * Returns the persistent device ID synchronously (recovering/creating in localStorage).
 */
export function getDeviceIdSync(): string {
    if (cachedMemoryDeviceId) return cachedMemoryDeviceId;

    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)?.trim();
            if (existing) {
                cachedMemoryDeviceId = existing;
                return existing;
            }
            const generated = generateUuid();
            window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
            cachedMemoryDeviceId = generated;
            return generated;
        }
    } catch {
        // Ignore storage restriction
    }

    cachedMemoryDeviceId = generateUuid();
    return cachedMemoryDeviceId;
}

/**
 * Reconciles device ID between localStorage and IndexedDB so clearing localStorage
 * alone doesn't silently create duplicate devices if IDB remains intact.
 */
export async function syncPersistentDeviceId(): Promise<string> {
    let lsId: string | null = null;
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            lsId = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)?.trim() || null;
        }
    } catch {
        lsId = null;
    }

    const idbId = await readDeviceIdFromIdb();
    const resolved = idbId || lsId || cachedMemoryDeviceId || generateUuid();

    cachedMemoryDeviceId = resolved;
    try {
        if (typeof window !== 'undefined' && window.localStorage && lsId !== resolved) {
            window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, resolved);
        }
    } catch {
        // Ignore
    }
    if (idbId !== resolved) {
        await writeDeviceIdToIdb(resolved);
    }

    return resolved;
}

/**
 * Extracts a concise human-readable platform + browser label for admin visibility.
 */
export function getDevicePlatformLabel(): string {
    if (typeof navigator === 'undefined') return 'Unknown Device';

    const ua = navigator.userAgent || '';
    const navWithUaData = navigator as Navigator & {
        userAgentData?: { platform?: string; mobile?: boolean };
    };
    const uaPlatform = navWithUaData.userAgentData?.platform || '';

    let os = 'Unknown OS';
    if (/android/i.test(ua)) {
        const ver = ua.match(/Android\s+([\d.]+)/i)?.[1];
        os = ver ? `Android ${ver.split('.')[0]}` : 'Android';
    } else if (/iphone|ipad|ipod/i.test(ua)) {
        const isIpad = /ipad/i.test(ua);
        os = isIpad ? 'iPadOS' : 'iOS';
    } else if (/mac os x|macintosh/i.test(ua) || /mac/i.test(uaPlatform)) {
        os = 'macOS';
    } else if (/windows/i.test(ua) || /win/i.test(uaPlatform)) {
        os = 'Windows';
    } else if (/linux/i.test(ua)) {
        os = 'Linux';
    }

    let browser = 'Browser';
    if (/edg\//i.test(ua)) browser = 'Edge';
    else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
    else if (/samsungbrowser/i.test(ua)) browser = 'Samsung Internet';
    else if (/crios|chrome/i.test(ua)) browser = 'Chrome';
    else if (/fxios|firefox/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua)) browser = 'Safari';

    return `${os} · ${browser}`;
}

export function getStoredClaimedPerson(): string | null {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        return window.localStorage.getItem('claimed_person')?.trim() || null;
    } catch {
        return null;
    }
}

export function getActiveAdminToken(): string | null {
    if (!activeAdminToken) return null;
    if (activeAdminTokenExpiresAt && Date.now() >= activeAdminTokenExpiresAt) {
        clearActiveAdminToken();
        return null;
    }
    return activeAdminToken;
}

export function setActiveAdminToken(token: string, expiresAt: number): void {
    activeAdminToken = token;
    activeAdminTokenExpiresAt = expiresAt;
}

export function clearActiveAdminToken(): void {
    activeAdminToken = null;
    activeAdminTokenExpiresAt = 0;
}

export interface AccessErrorEvent {
    status: number;
    code?: string;
    message: string;
    person?: string | null;
}

type AccessErrorListener = (event: AccessErrorEvent) => void;
const accessErrorListeners = new Set<AccessErrorListener>();

export function subscribeToAccessErrors(listener: AccessErrorListener): () => void {
    accessErrorListeners.add(listener);
    return () => {
        accessErrorListeners.delete(listener);
    };
}

export function notifyAccessError(event: AccessErrorEvent): void {
    accessErrorListeners.forEach((fn) => {
        try {
            fn(event);
        } catch {
            // Ignore listener errors
        }
    });
}
