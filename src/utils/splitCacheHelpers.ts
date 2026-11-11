import type { QueryClient } from '@tanstack/react-query';
import { queryKeys, type SplitsFilterParams } from '../api/queries';
import type {
    Split,
    UpdateSplitPayload,
} from '../api/types';

/**
 * Checks whether a split satisfies a cached `['splits', filter]` query key filter.
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

function getSplitsFilter(queryKey: readonly unknown[]): SplitsFilterParams | undefined {
    const maybeFilter = queryKey[1];
    if (maybeFilter && typeof maybeFilter === 'object') {
        return maybeFilter as SplitsFilterParams;
    }
    return undefined;
}

/**
 * Finds the best cached snapshot of a split across all `['splits', ...]` and `['split', splitId]` queries.
 */
export function findCachedSplitById(
    queryClient: QueryClient,
    splitId: string
): Split | undefined {
    const splitQueries = queryClient.getQueriesData<Split[]>({ queryKey: ['splits'] });
    for (const [, list] of splitQueries) {
        const found = list?.find((s) => s.splitId === splitId);
        if (found) return found;
    }
    return queryClient.getQueryData<Split>(queryKeys.splitDetails(splitId));
}

/**
 * Inserts a newly created/restored split into every matching `['splits', filter]` query cache.
 */
export function applySplitAddToCaches(
    queryClient: QueryClient,
    newSplit: Split
): void {
    const queries = queryClient.getQueryCache().findAll({ queryKey: ['splits'] });
    for (const query of queries) {
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
 * Transforms an existing split across all `['splits', filter]` list caches AND `['split', splitId]` detail cache.
 * Moves splits cleanly between filtered views (e.g. removing from `ACTIVE` and inserting into `SETTLED`)
 * while updating canonical `['splits', {}]` in place.
 */
export function applySplitTransformToCaches(
    queryClient: QueryClient,
    splitId: string,
    updater: (split: Split) => Split,
    fallbackSplit?: Split
): void {
    const baseSplit = findCachedSplitById(queryClient, splitId) || fallbackSplit;
    const transformedFallback = baseSplit ? updater(baseSplit) : undefined;

    const detailKey = queryKeys.splitDetails(splitId);
    if (queryClient.getQueryData<Split>(detailKey) !== undefined) {
        queryClient.setQueryData<Split>(detailKey, (old) => (old ? updater(old) : old));
    }

    const queries = queryClient.getQueryCache().findAll({ queryKey: ['splits'] });
    for (const query of queries) {
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
 * Removes a deleted split from every cached `['splits', ...]` list and clears its cached detail query.
 */
export function applySplitRemoveToCaches(
    queryClient: QueryClient,
    splitId: string
): void {
    const queries = queryClient.getQueryCache().findAll({ queryKey: ['splits'] });
    for (const query of queries) {
        queryClient.setQueryData<Split[]>(query.queryKey, (old) => {
            if (!old) return old;
            if (!old.some((s) => s.splitId === splitId)) return old;
            return old.filter((s) => s.splitId !== splitId);
        });
    }
    queryClient.removeQueries({
        queryKey: queryKeys.splitDetails(splitId),
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

