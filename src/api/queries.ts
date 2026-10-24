import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { PersonDetail, Split, SpendingsData, TripMetaItem, TripInfo } from './types';

export interface SplitsFilterParams {
    payee?: string;
    participant?: string;
    status?: 'ACTIVE' | 'SETTLED' | string;
    limit?: number;
    [key: string]: unknown;
}

// Query Keys
export const queryKeys = {
    categories: (refresh = false) => ['categories', { refresh }] as const,
    people: (refresh = false) => ['people', { refresh }] as const,
    peopleDetails: () => ['people', 'details'] as const,
    splits: (filters?: SplitsFilterParams) => ['splits', filters || {}] as const,
    splitDetails: (splitId: string) => ['split', splitId] as const,
    spendings: (payee: string) => ['spendings', payee] as const,
    meta: () => ['meta'] as const,
    tripInfo: (refresh = false) => ['trip-info', { refresh }] as const,
    health: () => ['health'] as const,
};

// 1. Categories Query
export function useCategories(refresh = false) {
    return useQuery<string[]>({
        queryKey: queryKeys.categories(refresh),
        queryFn: () => apiFetch<string[]>(`/categories?refresh=${refresh}`),
        staleTime: 1000 * 60 * 10, // 10 minutes cache
    });
}

// 2. People Query
export function usePeople(refresh = false) {
    return useQuery<string[]>({
        queryKey: queryKeys.people(refresh),
        queryFn: () => apiFetch<string[]>(`/people?refresh=${refresh}`),
        staleTime: 1000 * 60 * 10, // 10 minutes cache
    });
}

// 3. People Details Query (with UPI IDs)
export function usePeopleDetails() {
    return useQuery<PersonDetail[]>({
        queryKey: queryKeys.peopleDetails(),
        queryFn: () => apiFetch<PersonDetail[]>('/people/details'),
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });
}

// 4. Splits Query
export function useSplits(params?: SplitsFilterParams) {
    const queryParams = new URLSearchParams();
    if (params?.payee) queryParams.set('payee', params.payee);
    if (params?.participant) queryParams.set('participant', params.participant);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.limit) queryParams.set('limit', String(params.limit));

    const queryString = queryParams.toString();
    const endpoint = queryString ? `/splits?${queryString}` : '/splits';

    return useQuery<Split[]>({
        queryKey: queryKeys.splits(params),
        queryFn: () => apiFetch<Split[]>(endpoint),
        staleTime: 1000 * 30, // 30 seconds cache
    });
}

// 5. Split Details by ID
export function useSplitDetails(splitId?: string) {
    return useQuery<Split>({
        queryKey: queryKeys.splitDetails(splitId || ''),
        queryFn: () => apiFetch<Split>(`/split/${splitId}`),
        enabled: Boolean(splitId),
        staleTime: 1000 * 60 * 2, // 2 minutes
    });
}

// 6. Spendings by Payee
export function useSpendings(payee?: string) {
    return useQuery<SpendingsData>({
        queryKey: queryKeys.spendings(payee || ''),
        queryFn: () => apiFetch<SpendingsData>(`/spend/${encodeURIComponent(payee || '')}`),
        enabled: Boolean(payee),
        staleTime: 1000 * 60, // 1 minute
    });
}

// 7. Trip Metadata Query
export function useTripMeta() {
    return useQuery<TripMetaItem[]>({
        queryKey: queryKeys.meta(),
        queryFn: () => apiFetch<TripMetaItem[]>('/meta'),
        staleTime: 1000 * 60 * 15, // 15 minutes
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
    return useQuery<TripInfo>({
        queryKey: queryKeys.tripInfo(refresh),
        queryFn: () => apiFetch<TripInfo>(`/trip-info${refresh ? '?refresh=true' : ''}`),
        staleTime: 1000 * 30, // 30 seconds
        refetchOnWindowFocus: true, // Refresh when switching back to tab
    });
}
