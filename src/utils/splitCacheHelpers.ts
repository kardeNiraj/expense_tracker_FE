import type { QueryClient } from '@tanstack/react-query';
import { getGroupCacheScope, queryKeys, type SplitsFilterParams } from '../api/queries';
import type {
    Split,
    UpdateSplitPayload,
} from '../api/types';

/**
 * Checks whether a split satisfies a cached `['splits', groupScope, filter]` query key filter.
 */
export function matchesSplitsFilter(
    split: Split,
    filter?: SplitsFilterParams
): boolean {
    const splitStatus = (split.status || 'ACTIVE').trim().toUpperCase();
    if (splitStatus === 'DELETED') {
        return false;
    }

    if (filter?.status) {
        const requestedStatus = String(filter.status).trim().toUpperCase();
        if (requestedStatus && requestedStatus !== 'ALL' && splitStatus !== requestedStatus) {
            return false;
        }
    }

    if (filter?.payee) {
        const requestedPayee = String(filter.payee).trim().toLowerCase();
        if ((split.paidBy || '').trim().toLowerCase() !== requestedPayee) {
            return false;
        }
    }

    if (filter?.participant) {
        const requestedParticipant = String(filter.participant).trim().toLowerCase();
        const isParticipant = (split.participants || []).some(
            (p) => p.trim().toLowerCase() === requestedParticipant
        );
        const isPayer = (split.paidBy || '').trim().toLowerCase() === requestedParticipant;
        if (!isParticipant && !isPayer) {
            return false;
        }
    }

    return true;
}

function getSplitsGroupScope(queryKey: readonly unknown[]): string {
    if (typeof queryKey[1] === 'string' && queryKey[1]) {
        return queryKey[1];
    }
    return '__default__';
}

function getSplitsFilter(queryKey: readonly unknown[]): SplitsFilterParams | undefined {
    const maybeFilter = typeof queryKey[1] === 'string' ? queryKey[2] : queryKey[1];
    if (maybeFilter && typeof maybeFilter === 'object') {
        return maybeFilter as SplitsFilterParams;
    }
    return undefined;
}

function doesGroupMatch(queryScope: string, targetScope: string): boolean {
    return queryScope === targetScope;
}

/**
 * Finds the best cached snapshot of a split across matching `['splits', ...]` and `['split', ...]` queries.
 */
export function findCachedSplitById(
    queryClient: QueryClient,
    splitId: string,
    groupId?: string | null
): Split | undefined {
    const targetScope = getGroupCacheScope(groupId);
    const splitQueries = queryClient.getQueriesData<Split[]>({ queryKey: ['splits'] });
    for (const [key, list] of splitQueries) {
        if (!doesGroupMatch(getSplitsGroupScope(key), targetScope)) continue;
        const found = list?.find((s) => s.splitId === splitId);
        if (found) return found;
    }
    return queryClient.getQueryData<Split>(queryKeys.splitDetails(splitId, groupId));
}

/**
 * Inserts a newly created/restored split into every matching `['splits', groupScope, filter]` query cache.
 */
export function applySplitAddToCaches(
    queryClient: QueryClient,
    newSplit: Split
): void {
    const splitGroupScope = getGroupCacheScope(newSplit.groupId);
    const queries = queryClient.getQueryCache().findAll({ queryKey: ['splits'] });
    for (const query of queries) {
        if (!doesGroupMatch(getSplitsGroupScope(query.queryKey), splitGroupScope)) {
            continue;
        }
        const filter = getSplitsFilter(query.queryKey);
        if (!matchesSplitsFilter(newSplit, filter)) {
            continue;
        }
        queryClient.setQueryData<Split[]>(query.queryKey, (old) => {
            if (!old) return [newSplit];
            if (old.some((s) => s.splitId === newSplit.splitId)) return old;
            return [newSplit, ...old];
        });
    }
}

/**
 * Transforms an existing split across matching `['splits', ...]` list caches AND `['split', ...]` detail cache.
 */
export function applySplitTransformToCaches(
    queryClient: QueryClient,
    splitId: string,
    updater: (split: Split) => Split,
    fallbackSplit?: Split,
    groupId?: string | null
): void {
    const targetGroupId = groupId !== undefined ? groupId : fallbackSplit?.groupId;
    const targetScope = getGroupCacheScope(targetGroupId);
    const baseSplit =
        findCachedSplitById(queryClient, splitId, targetGroupId) || fallbackSplit;
    const transformedFallback = baseSplit ? updater(baseSplit) : undefined;

    const detailKey = queryKeys.splitDetails(splitId, targetGroupId);
    if (queryClient.getQueryData<Split>(detailKey) !== undefined) {
        queryClient.setQueryData<Split>(detailKey, (old) => (old ? updater(old) : old));
    }

    const queries = queryClient.getQueryCache().findAll({ queryKey: ['splits'] });
    for (const query of queries) {
        if (!doesGroupMatch(getSplitsGroupScope(query.queryKey), targetScope)) {
            continue;
        }
        const filter = getSplitsFilter(query.queryKey);
        queryClient.setQueryData<Split[]>(query.queryKey, (old) => {
            if (!old) return old;
            const exists = old.some((s) => s.splitId === splitId);
            if (exists) {
                let nextSplit: Split | undefined;
                const mapped = old.map((s) => {
                    if (s.splitId !== splitId) return s;
                    nextSplit = updater(s);
                    return nextSplit;
                });
                if (nextSplit && !matchesSplitsFilter(nextSplit, filter)) {
                    return mapped.filter((s) => s.splitId !== splitId);
                }
                return mapped;
            }

            if (transformedFallback && matchesSplitsFilter(transformedFallback, filter)) {
                return [transformedFallback, ...old];
            }

            return old;
        });
    }
}

/**
 * Removes a deleted split from matching cached `['splits', ...]` lists and clears its cached detail query.
 */
export function applySplitRemoveToCaches(
    queryClient: QueryClient,
    splitId: string,
    groupId?: string | null
): void {
    const targetScope = getGroupCacheScope(groupId);
    const queries = queryClient.getQueryCache().findAll({ queryKey: ['splits'] });
    for (const query of queries) {
        if (!doesGroupMatch(getSplitsGroupScope(query.queryKey), targetScope)) {
            continue;
        }
        queryClient.setQueryData<Split[]>(query.queryKey, (old) => {
            if (!old) return old;
            if (!old.some((s) => s.splitId === splitId)) return old;
            return old.filter((s) => s.splitId !== splitId);
        });
    }
    queryClient.removeQueries({
        queryKey: queryKeys.splitDetails(splitId, groupId),
        exact: true,
    });
}

/**
 * Applies a participant settlement status change to a Split cleanly.
 */
export function withSettlementStatus(
    split: Split,
    from: string,
    to?: string,
    settled: boolean = true
): Split {
    const targetFrom = from.trim().toLowerCase();
    const targetTo = to?.trim().toLowerCase();
    const nextSettlementStatus: 'SETTLED' | 'PENDING' = settled ? 'SETTLED' : 'PENDING';

    const settlements = (split.settlements || []).map((settle) => {
        const match =
            settle.from.trim().toLowerCase() === targetFrom &&
            (!targetTo || settle.to.trim().toLowerCase() === targetTo);
        return match ? { ...settle, status: nextSettlementStatus } : settle;
    });

    const allSettled =
        settlements.length > 0
            ? settlements.every((st) => st.status === 'SETTLED')
            : settled;

    return {
        ...split,
        settlements,
        status: allSettled ? ('SETTLED' as const) : ('ACTIVE' as const),
    };
}

/**
 * Applies partial split metadata edits cleanly without mutating original objects.
 */
export function withUpdatedSplitFields(
    split: Split,
    updates: UpdateSplitPayload
): Split {
    return {
        ...split,
        description: updates.description ?? split.description,
        category: updates.category ?? split.category,
        totalAmount: updates.amount ?? split.totalAmount,
        participants: updates.participants ?? split.participants,
    };
}
