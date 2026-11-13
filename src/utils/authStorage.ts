import type { AuthUser, GroupSummary } from '../api/types';

const USER_TOKEN_KEY = 'splitnest_user_token';
const USER_TOKEN_EXPIRES_KEY = 'splitnest_user_token_expires_at';
const USER_PROFILE_KEY = 'splitnest_user_profile';
const USER_GROUPS_KEY = 'splitnest_user_groups';
const ACTIVE_GROUP_ID_KEY = 'splitnest_active_group_id';
const PENDING_INVITE_CODE_KEY = 'splitnest_pending_invite_code';
const PENDING_RECOVER_TOKEN_KEY = 'splitnest_pending_recover_token';

let memoryUserToken: string | null = null;
let memoryUserTokenExpiresAt = 0;
let memoryUserProfile: AuthUser | null = null;
let memoryUserGroups: GroupSummary[] | null = null;
let memoryActiveGroupId: string | null = null;
let memoryPendingInviteCode: string | null = null;
let memoryPendingRecoverToken: string | null = null;

type UserAuthExpiredListener = () => void;
const authExpiredListeners = new Set<UserAuthExpiredListener>();

export function subscribeToUserAuthExpired(listener: UserAuthExpiredListener): () => void {
    authExpiredListeners.add(listener);
    return () => {
        authExpiredListeners.delete(listener);
    };
}

export function notifyUserAuthExpired(): void {
    clearAllUserAuthStorage();
    authExpiredListeners.forEach((fn) => {
        try {
            fn();
        } catch {
            // ignore listener error
        }
    });
}

export function getUserToken(): string | null {
    if (memoryUserToken) {
        if (memoryUserTokenExpiresAt && Date.now() >= memoryUserTokenExpiresAt) {
            clearUserToken();
            return null;
        }
        return memoryUserToken;
    }

    try {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        const token = window.localStorage.getItem(USER_TOKEN_KEY)?.trim() || null;
        const expiresRaw = window.localStorage.getItem(USER_TOKEN_EXPIRES_KEY);
        const expiresAt = expiresRaw ? Number(expiresRaw) : 0;
        if (!token) return null;
        if (expiresAt && Date.now() >= expiresAt) {
            clearUserToken();
            return null;
        }
        memoryUserToken = token;
        memoryUserTokenExpiresAt = expiresAt;
        return token;
    } catch {
        return null;
    }
}

export function setUserToken(token: string, expiresAt?: number): void {
    memoryUserToken = token;
    memoryUserTokenExpiresAt = expiresAt || 0;
    try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        window.localStorage.setItem(USER_TOKEN_KEY, token);
        if (expiresAt) {
            window.localStorage.setItem(USER_TOKEN_EXPIRES_KEY, String(expiresAt));
        } else {
            window.localStorage.removeItem(USER_TOKEN_EXPIRES_KEY);
        }
    } catch {
        // ignore storage errors
    }
}

export function clearUserToken(): void {
    memoryUserToken = null;
    memoryUserTokenExpiresAt = 0;
    try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        window.localStorage.removeItem(USER_TOKEN_KEY);
        window.localStorage.removeItem(USER_TOKEN_EXPIRES_KEY);
    } catch {
        // ignore
    }
}

function normalizeStoredUser(candidate: unknown): AuthUser | null {
    if (!candidate || typeof candidate !== 'object') return null;
    const obj = candidate as Partial<AuthUser> & { user?: unknown };
    if (typeof obj.userId === 'string' && obj.userId.trim()) {
        return obj as AuthUser;
    }
    if (obj.user && typeof obj.user === 'object') {
        const nested = obj.user as Partial<AuthUser>;
        if (typeof nested.userId === 'string' && nested.userId.trim()) {
            return nested as AuthUser;
        }
    }
    return null;
}

export function getStoredUserProfile(): AuthUser | null {
    if (memoryUserProfile) {
        const normalized = normalizeStoredUser(memoryUserProfile);
        if (normalized) return normalized;
    }
    try {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        const raw = window.localStorage.getItem(USER_PROFILE_KEY);
        if (!raw) return null;
        const normalized = normalizeStoredUser(JSON.parse(raw));
        if (normalized) {
            memoryUserProfile = normalized;
            return normalized;
        }
    } catch {
        // ignore malformed json
    }
    return null;
}

export function setStoredUserProfile(user: AuthUser | null): void {
    const normalized = normalizeStoredUser(user);
    memoryUserProfile = normalized;
    try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        if (normalized) {
            window.localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(normalized));
        } else {
            window.localStorage.removeItem(USER_PROFILE_KEY);
        }
    } catch {
        // ignore
    }
}

export function getActiveGroupId(): string | null {
    if (memoryActiveGroupId !== null) {
        return memoryActiveGroupId || null;
    }
    try {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        const saved = window.localStorage.getItem(ACTIVE_GROUP_ID_KEY)?.trim() || '';
        memoryActiveGroupId = saved;
        return saved || null;
    } catch {
        return null;
    }
}

export function setActiveGroupIdStorage(groupId: string | null): void {
    const clean = groupId ? groupId.trim() : '';
    memoryActiveGroupId = clean;
    try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        if (clean) {
            window.localStorage.setItem(ACTIVE_GROUP_ID_KEY, clean);
        } else {
            window.localStorage.removeItem(ACTIVE_GROUP_ID_KEY);
        }
    } catch {
        // ignore
    }
}

export function getPendingInviteCode(): string | null {
    if (memoryPendingInviteCode !== null) {
        return memoryPendingInviteCode || null;
    }
    try {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        const saved = window.localStorage.getItem(PENDING_INVITE_CODE_KEY)?.trim() || '';
        memoryPendingInviteCode = saved;
        return saved || null;
    } catch {
        return null;
    }
}

export function setPendingInviteCodeStorage(code: string | null): void {
    const clean = code ? code.trim() : '';
    memoryPendingInviteCode = clean;
    try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        if (clean) {
            window.localStorage.setItem(PENDING_INVITE_CODE_KEY, clean);
        } else {
            window.localStorage.removeItem(PENDING_INVITE_CODE_KEY);
        }
    } catch {
        // ignore
    }
}

export function getPendingRecoverToken(): string | null {
    if (memoryPendingRecoverToken !== null) {
        return memoryPendingRecoverToken || null;
    }
    try {
        if (typeof window === 'undefined' || !window.sessionStorage) return null;
        const saved = window.sessionStorage.getItem(PENDING_RECOVER_TOKEN_KEY)?.trim() || '';
        memoryPendingRecoverToken = saved;
        return saved || null;
    } catch {
        return null;
    }
}

export function setPendingRecoverTokenStorage(token: string | null): void {
    const clean = token ? token.trim() : '';
    memoryPendingRecoverToken = clean;
    try {
        if (typeof window === 'undefined' || !window.sessionStorage) return;
        if (clean) {
            window.sessionStorage.setItem(PENDING_RECOVER_TOKEN_KEY, clean);
        } else {
            window.sessionStorage.removeItem(PENDING_RECOVER_TOKEN_KEY);
        }
    } catch {
        // ignore
    }
}

export function getStoredUserGroups(): GroupSummary[] {
    if (memoryUserGroups) return memoryUserGroups;
    try {
        if (typeof window === 'undefined' || !window.localStorage) return [];
        const raw = window.localStorage.getItem(USER_GROUPS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as GroupSummary[];
        if (Array.isArray(parsed)) {
            memoryUserGroups = parsed;
            return parsed;
        }
    } catch {
        // ignore
    }
    return [];
}

export function setStoredUserGroups(groups: GroupSummary[]): void {
    memoryUserGroups = groups;
    try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        window.localStorage.setItem(USER_GROUPS_KEY, JSON.stringify(groups));
    } catch {
        // ignore
    }
}

export function clearAllUserAuthStorage(): void {
    clearUserToken();
    setStoredUserProfile(null);
    memoryUserGroups = null;
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(USER_GROUPS_KEY);
        }
    } catch {
        // ignore
    }
    setActiveGroupIdStorage(null);
}

/**
 * Extracts `?join=<CODE>`, `/join/<CODE>`, `?recover=<TOKEN>`, or `?groupId=<ID>` on startup and cleans URL query params.
 */
export function extractStartupUrlParams(): {
    inviteCode: string | null;
    groupId: string | null;
    recoverToken: string | null;
} {
    if (typeof window === 'undefined') {
        return { inviteCode: null, groupId: null, recoverToken: null };
    }

    try {
        const url = new URL(window.location.href);
        let inviteCode: string | null = url.searchParams.get('join')?.trim() || null;
        let changed = false;

        if (!inviteCode) {
            const pathMatch = url.pathname.match(/^\/join\/([a-zA-Z0-9_-]{4,128})\/?$/i);
            if (pathMatch?.[1]) {
                inviteCode = pathMatch[1];
                url.pathname = '/';
                changed = true;
            }
        }

        if (url.searchParams.has('join')) {
            url.searchParams.delete('join');
            changed = true;
        }

        const recoverToken = url.searchParams.get('recover')?.trim() || null;
        if (url.searchParams.has('recover')) {
            url.searchParams.delete('recover');
            changed = true;
        }

        const groupId = url.searchParams.get('groupId')?.trim() || null;
        if (groupId) {
            setActiveGroupIdStorage(groupId);
            url.searchParams.delete('groupId');
            changed = true;
        }

        if (inviteCode) {
            setPendingInviteCodeStorage(inviteCode);
        }
        if (recoverToken) {
            setPendingRecoverTokenStorage(recoverToken);
        }

        if (changed) {
            const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
            window.history.replaceState(window.history.state, '', cleanUrl || '/');
        }

        return {
            inviteCode: inviteCode || getPendingInviteCode(),
            groupId: groupId || getActiveGroupId(),
            recoverToken: recoverToken || getPendingRecoverToken(),
        };
    } catch {
        return {
            inviteCode: getPendingInviteCode(),
            groupId: getActiveGroupId(),
            recoverToken: getPendingRecoverToken(),
        };
    }
}
