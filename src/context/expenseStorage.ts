import { ENV } from '../config';
import type { AppTab } from './ExpenseContextDef';
import { getActiveAdminToken } from '../utils/deviceIdentity';

export const TAB_TO_PATH: Record<AppTab, string> = {
    dashboard: '/',
    splits: '/splits',
    add: '/add',
    analytics: '/analytics',
    people: '/people',
    groups: '/groups',
    admin: '/admin',
};

export function getTabFromPathname(pathname: string): AppTab {
    const clean = pathname.replace(/\/+$/, '').toLowerCase() || '/';
    if (clean === '/admin') return 'admin';
    if (clean === '/analytics') return 'analytics';
    if (clean === '/splits') return 'splits';
    if (clean === '/add') return 'add';
    if (clean === '/people') return 'people';
    if (clean === '/groups') return 'groups';
    return 'dashboard';
}

export function pushTabPath(tab: AppTab): void {
    if (typeof window === 'undefined') return;
    const targetPath = TAB_TO_PATH[tab] || '/';
    const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
    if (currentPath !== targetPath) {
        window.history.pushState({ tab }, '', targetPath);
    }
}

export function readInitialClaimedPerson(): string | null {
    try {
        return localStorage.getItem('claimed_person')?.trim() || null;
    } catch {
        return null;
    }
}

export function readInitialActivePerson(): string {
    try {
        const claimed = localStorage.getItem('claimed_person')?.trim();
        const saved =
            localStorage.getItem('active_person')?.trim() ||
            localStorage.getItem('manali_active_person')?.trim();
        if (getActiveAdminToken() && saved) return saved;
        if (claimed) return claimed;
        if (saved) return saved;
    } catch {
        // fallback
    }
    return ENV.DEFAULT_ACTIVE_PERSON;
}

export function persistClaimedPerson(name: string): void {
    try {
        localStorage.setItem('claimed_person', name);
        localStorage.setItem('active_person', name);
    } catch {
        // ignore storage errors
    }
}

export function persistActivePerson(name: string): void {
    try {
        localStorage.setItem('active_person', name);
        localStorage.setItem('manali_active_person', name);
    } catch {
        // ignore storage errors
    }
}

export function clearPersistedClaim(): void {
    try {
        localStorage.removeItem('claimed_person');
        localStorage.removeItem('active_person');
        localStorage.removeItem('manali_active_person');
    } catch {
        // ignore storage errors
    }
}

