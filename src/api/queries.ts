import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import { ENV } from '../config';
import { getActiveGroupId } from '../utils/authStorage';
import type {
    AdminDashboardData,
    AnalyticsData,
    AnalyticsRange,
    DeviceStateResponse,
    PersonDetail,
    PushDeviceStatusResponse,
    PushPublicConfig,
    Split,
    SpendingsData,
    TripMetaItem,
    TripInfo,
} from './types';

const DYNAMIC_LIST_STALE_TIME_MS = Math.min(ENV.QUERY_STALE_TIME_MS, 30_000);

export function getGroupCacheScope(groupId?: string | null): string {
    const resolved = groupId !== undefined ? groupId : getActiveGroupId();
    return resolved && resolved.trim() ? resolved.trim() : '__default__';
}

export interface AnalyticsQueryParams {
    person?: string;
    month?: string;
    range?: AnalyticsRange;
}

export interface SplitsFilterParams {
    payee?: string;
    participant?: string;
    status?: 'ACTIVE' | 'SETTLED' | string;
    limit?: number;
    [key: string]: unknown;
}

// Query Keys (strictly scoped by active room / groupId so multi-room caches stay isolated)
export const queryKeys = {
    categories: (refresh = false) => ['categories', { refresh }] as const,
    people: (refresh = false, groupId?: string | null) =>
        ['people', getGroupCacheScope(groupId), { refresh }] as const,
    peopleDetails: (groupId?: string | null) =>
        ['people', 'details', getGroupCacheScope(groupId)] as const,
    splits: (filters?: SplitsFilterParams, groupId?: string | null) =>
        ['splits', getGroupCacheScope(groupId), filters || {}] as const,
    splitDetails: (splitId: string, groupId?: string | null) =>
        ['split', getGroupCacheScope(groupId), splitId] as const,
    spendings: (payee: string, groupId?: string | null) =>
        ['spendings', getGroupCacheScope(groupId), payee] as const,
    analytics: (params?: AnalyticsQueryParams, groupId?: string | null) =>
        ['analytics', getGroupCacheScope(groupId), params || {}] as const,
    meta: (groupId?: string | null) => ['meta', getGroupCacheScope(groupId)] as const,
    tripInfo: (refresh = false, groupId?: string | null) =>
        ['trip-info', getGroupCacheScope(groupId), { refresh }] as const,
    health: () => ['health'] as const,
    deviceMe: (groupId?: string | null) => ['device', 'me', getGroupCacheScope(groupId)] as const,
    adminAnalytics: (refresh = false, groupId?: string | null) =>
        ['admin', 'analytics', getGroupCacheScope(groupId), { refresh }] as const,
    pushConfig: () => ['notifications', 'config'] as const,
    pushStatus: () => ['notifications', 'status'] as const,
};

// 1. Categories Query
export function useCategories(refresh = false) {
    return useQuery<string[]>({
        queryKey: queryKeys.categories(refresh),
        queryFn: () => apiFetch<string[]>(`/categories?refresh=${refresh}`),
        staleTime: 1000 * 60 * 30, // 30 minutes cache
        gcTime: 1000 * 60 * 60 * 24 * 7,
        networkMode: 'offlineFirst',
    });
}

// 2. People Query
export function usePeople(refresh = false, groupId?: string | null) {
    const queryParam = groupId && groupId !== 'ALL' ? `groupId=${encodeURIComponent(groupId)}` : '';
    const refreshParam = refresh ? 'refresh=true' : '';
    const queryParams = [queryParam, refreshParam].filter(Boolean).join('&');
    return useQuery<string[]>({
        queryKey: queryKeys.people(refresh, groupId),
        queryFn: () =>
            apiFetch<string[]>(
                `/people${queryParams ? `?${queryParams}` : ''}`
            ),
        staleTime: 1000 * 60 * 2, // 2 minutes cache
        gcTime: 1000 * 60 * 60 * 24 * 7,
        networkMode: 'offlineFirst',
    });
}

// 3. People Details Query (with UPI IDs)
export function usePeopleDetails(refresh = false) {
    const groupScope = getGroupCacheScope();
    return useQuery<PersonDetail[]>({
        queryKey: queryKeys.peopleDetails(groupScope),
        queryFn: () => apiFetch<PersonDetail[]>(`/people/details?refresh=${refresh}`),
        staleTime: 1000 * 60 * 2, // 2 minutes cache
        gcTime: 1000 * 60 * 60 * 24 * 7,
        networkMode: 'offlineFirst',
    });
}

// 4. Splits Query
export function useSplits(params?: SplitsFilterParams) {
    const groupScope = getGroupCacheScope();
    const queryParams = new URLSearchParams();
    if (params?.payee) queryParams.set('payee', params.payee);
    if (params?.participant) queryParams.set('participant', params.participant);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.limit) queryParams.set('limit', String(params.limit));

    const queryString = queryParams.toString();
    const endpoint = queryString ? `/splits?${queryString}` : '/splits';

    return useQuery<Split[]>({
        queryKey: queryKeys.splits(params, groupScope),
        queryFn: () => apiFetch<Split[]>(endpoint),
        staleTime: DYNAMIC_LIST_STALE_TIME_MS,
        gcTime: 1000 * 60 * 60 * 24 * 7,
        networkMode: 'offlineFirst',
    });
}

// 5. Split Details by ID
export function useSplitDetails(splitId?: string) {
    const groupScope = getGroupCacheScope();
    return useQuery<Split>({
        queryKey: queryKeys.splitDetails(splitId || '', groupScope),
        queryFn: () => apiFetch<Split>(`/split/${splitId}`),
        enabled: Boolean(splitId),
        staleTime: DYNAMIC_LIST_STALE_TIME_MS,
        gcTime: 1000 * 60 * 60 * 24 * 7,
        networkMode: 'offlineFirst',
    });
}

// 6. Spendings by Payee
export function useSpendings(payee?: string) {
    const groupScope = getGroupCacheScope();
    return useQuery<SpendingsData>({
        queryKey: queryKeys.spendings(payee || '', groupScope),
        queryFn: () => apiFetch<SpendingsData>(`/spend/${encodeURIComponent(payee || '')}`),
        enabled: Boolean(payee),
        staleTime: DYNAMIC_LIST_STALE_TIME_MS,
        gcTime: 1000 * 60 * 60 * 24 * 7,
        networkMode: 'offlineFirst',
    });
}

// 7. Trip Metadata Query
export function useTripMeta() {
    const groupScope = getGroupCacheScope();
    return useQuery<TripMetaItem[]>({
        queryKey: queryKeys.meta(groupScope),
        queryFn: () => apiFetch<TripMetaItem[]>('/meta'),
        staleTime: 1000 * 60 * 30, // 30 minutes
        gcTime: 1000 * 60 * 60 * 24 * 7,
        networkMode: 'offlineFirst',
    });
}

// 8. Health check
export function useHealthCheck() {
    return useQuery<{ message: string; status: string }>({
        queryKey: queryKeys.health(),
        queryFn: () => apiFetch<{ message: string; status: string }>('/'),
        staleTime: 1000 * 60,
        retry: 1,
    });
}

// 9. Trip Info & Branding Query
export function useTripInfo(refresh = false) {
    const groupScope = getGroupCacheScope();
    return useQuery<TripInfo>({
        queryKey: queryKeys.tripInfo(refresh, groupScope),
        queryFn: () => apiFetch<TripInfo>(`/trip-info${refresh ? '?refresh=true' : ''}`),
        staleTime: 1000 * 60 * 15, // 15 minutes
        gcTime: 1000 * 60 * 60 * 24 * 7,
        networkMode: 'offlineFirst',
        refetchOnWindowFocus: false,
    });
}

// 10. Spend Analytics Query
export function useAnalytics(params?: AnalyticsQueryParams & { enabled?: boolean }) {
    const groupScope = getGroupCacheScope();
    const queryParams = new URLSearchParams();
    if (params?.person) queryParams.set('person', params.person);
    if (params?.month && params.month !== 'ALL') queryParams.set('month', params.month);
    if (params?.range && params.range !== 'all') queryParams.set('range', params.range);

    const queryString = queryParams.toString();
    const endpoint = queryString ? `/analytics?${queryString}` : '/analytics';

    const cleanKeyParams: AnalyticsQueryParams = {
        person: params?.person || 'ALL',
        month: params?.month || 'ALL',
        range: params?.range || 'all',
    };

    return useQuery<AnalyticsData>({
        queryKey: queryKeys.analytics(cleanKeyParams, groupScope),
        queryFn: () => apiFetch<AnalyticsData>(endpoint),
        enabled: params?.enabled ?? true,
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60 * 2, // 2 minutes cache
        gcTime: 1000 * 60 * 60 * 24 * 7,
        networkMode: 'offlineFirst',
    });
}

// 11. Current Device State Query
export function useDeviceMe(enabled = true) {
    const groupScope = getGroupCacheScope();
    return useQuery<DeviceStateResponse>({
        queryKey: queryKeys.deviceMe(groupScope),
        queryFn: () => apiFetch<DeviceStateResponse>('/devices/me'),
        enabled,
        staleTime: 1000 * 30,
        networkMode: 'online',
        retry: 1,
    });
}

// 12. Strict Admin Analytics & Device Control Query
export function useAdminDashboard(
    enabled = true,
    refresh = false,
    scopeGroupId?: string | null
) {
    const scope = scopeGroupId !== undefined ? scopeGroupId : 'ALL';
    const scopeParam = `groupId=${encodeURIComponent(scope || 'ALL')}`;
    const refreshParam = refresh ? 'refresh=true' : '';
    const queryParams = [scopeParam, refreshParam].filter(Boolean).join('&');
    return useQuery<AdminDashboardData>({
        queryKey: queryKeys.adminAnalytics(refresh, scope),
        queryFn: () =>
            apiFetch<AdminDashboardData>(
                `/admin/analytics?${queryParams}`
            ),
        enabled,
        staleTime: 1000 * 15,
        gcTime: 0,
        networkMode: 'online',
        retry: false,
    });
}

// 13. Web Push Server Config (VAPID Public Key)
export function usePushConfig(enabled = true) {
    return useQuery<PushPublicConfig>({
        queryKey: queryKeys.pushConfig(),
        queryFn: () => apiFetch<PushPublicConfig>('/notifications/vapid-public-key'),
        enabled,
        staleTime: 1000 * 60 * 10,
        networkMode: 'online',
        retry: 1,
    });
}

// 14. Current Device Web Push Subscription Status
export function usePushStatus(enabled = true) {
    return useQuery<PushDeviceStatusResponse>({
        queryKey: queryKeys.pushStatus(),
        queryFn: () => apiFetch<PushDeviceStatusResponse>('/notifications/status'),
        enabled,
        staleTime: 1000 * 30,
        networkMode: 'online',
        retry: 1,
    });
}
