import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queries';
import { getActiveGroupId } from '../utils/authStorage';
import {
    enqueueOfflineMutation,
    processOfflineQueue,
} from '../utils/offlineQueue';
import {
    applySplitAddToCaches,
    applySplitRemoveToCaches,
    applySplitTransformToCaches,
    findCachedSplitById,
    withSettlementStatus,
    withUpdatedSplitFields,
} from '../utils/splitCacheHelpers';
import type {
    AddExpensePayload,
    AddSplitPayload,
    AddContributionPayload,
    SettleParticipantPayload,
    UpdateUpiPayload,
    UpdateSplitPayload,
    Split,
    SpendingsData,
    ExpenseRecord,
} from './types';

function createClientId(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

// Per-invocation WeakMaps avoid module-global race conditions across rapid mutations
const preparedExpenseMap = new WeakMap<AddExpensePayload, AddExpensePayload>();
const preparedSplitMap = new WeakMap<AddSplitPayload, AddSplitPayload>();
const previousUpiMap = new WeakMap<UpdateUpiPayload, string | undefined>();
const previousDeletedSplitMap = new WeakMap<object, Split | undefined>();
const previousUpdatedSplitMap = new WeakMap<UpdateSplitPayload, Split | undefined>();

function createOptimisticSplit(payload: AddSplitPayload): Split {
    let settlements: {
        from: string;
        to: string;
        amount: number;
        status: 'PENDING';
    }[];

    if (payload.splitMode === 'CUSTOM' && payload.customShares && payload.customShares.length > 0) {
        const shareMap = new Map(payload.customShares.map((cs) => [cs.person.toLowerCase(), cs.share]));
        settlements = payload.participants
            .filter((p) => p.toLowerCase() !== payload.paidBy.toLowerCase())
            .map((debtor) => ({
                from: debtor,
                to: payload.paidBy,
                amount: shareMap.get(debtor.toLowerCase()) || 0,
                status: 'PENDING' as const,
            }))
            .filter((s) => s.amount > 0);
    } else {
        const participantCount = payload.participants.length || 1;
        const perPerson = Math.round((payload.amount / participantCount) * 100) / 100;

        settlements = payload.participants
            .filter((p) => p.toLowerCase() !== payload.paidBy.toLowerCase())
            .map((debtor) => ({
                from: debtor,
                to: payload.paidBy,
                amount: perPerson,
                status: 'PENDING' as const,
            }));
    }

    const splitId = payload.splitId || createClientId('split');

    return {
        splitId,
        groupId: payload.groupId ?? getActiveGroupId(),
        description: payload.description,
        category: payload.category,
        totalAmount: payload.amount,
        paidBy: payload.paidBy,
        createdBy: payload.createdBy,
        participants: payload.participants,
        contributions: payload.contributions || [],
        settlements,
        status: 'ACTIVE',
        timestamp: payload.timestamp || new Date().toISOString(),
    };
}

// 1. ADD EXPENSE MUTATION WITH WRITE-AHEAD QUEUE & OPTIMISTIC UI
export function useAddExpenseMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        networkMode: 'always',
        mutationFn: async (variables: AddExpensePayload) => {
            const payload = preparedExpenseMap.get(variables) || {
                ...variables,
                groupId: variables.groupId ?? getActiveGroupId(),
                expenseId: variables.expenseId || createClientId('exp'),
                timestamp: variables.timestamp || new Date().toISOString(),
            };
            preparedExpenseMap.delete(variables);

            enqueueOfflineMutation('ADD_EXPENSE', payload);

            setTimeout(() => {
                processOfflineQueue(queryClient).catch((err) => {
                    console.warn('[Queue] Background sync error for ADD_EXPENSE:', err);
                });
            }, 50);

            return { message: 'Saved and queued for sync', status: 'queued', offline: true };
        },
        onMutate: async (newExpense) => {
            const groupId = newExpense.groupId ?? getActiveGroupId();
            const prepared: AddExpensePayload = {
                ...newExpense,
                groupId,
                expenseId: newExpense.expenseId || createClientId('exp'),
                timestamp: newExpense.timestamp || new Date().toISOString(),
            };
            preparedExpenseMap.set(newExpense, prepared);

            const spendingsKey = queryKeys.spendings(prepared.payee, groupId);
            const prevSpendings = queryClient.getQueryData<SpendingsData>(spendingsKey);

            await queryClient.cancelQueries({ queryKey: ['spendings'] });

            if (prevSpendings) {
                const newRecord: ExpenseRecord = {
                    category: prepared.category,
                    amount: prepared.amount,
                    description: prepared.description,
                    timestamp: prepared.timestamp,
                    isSplitRow: false,
                };
                queryClient.setQueryData<SpendingsData>(spendingsKey, {
                    ...prevSpendings,
                    today: prevSpendings.today + prepared.amount,
                    currentMonth: prevSpendings.currentMonth + prepared.amount,
                    total: prevSpendings.total + prepared.amount,
                    ...(typeof prevSpendings.directToday === 'number'
                        ? { directToday: prevSpendings.directToday + prepared.amount }
                        : {}),
                    ...(typeof prevSpendings.directCurrentMonth === 'number'
                        ? { directCurrentMonth: prevSpendings.directCurrentMonth + prepared.amount }
                        : {}),
                    ...(typeof prevSpendings.directTotal === 'number'
                        ? { directTotal: prevSpendings.directTotal + prepared.amount }
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

            return { prevSpendings, spendingsKey };
        },
        onError: (_err, _vars, context) => {
            if (context?.spendingsKey && context.prevSpendings !== undefined) {
                queryClient.setQueryData(context.spendingsKey, context.prevSpendings);
            }
        },
        onSuccess: () => {
            // Optimistic state is safely rendered and stored in IndexedDB.
            // Canonical data is updated when processOfflineQueue succeeds in background.
        },
    });
}

// 2. ADD SPLIT MUTATION WITH WRITE-AHEAD QUEUE & OPTIMISTIC UI
export function useAddSplitMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        networkMode: 'always',
        mutationFn: async (variables: AddSplitPayload) => {
            const payload = preparedSplitMap.get(variables) || {
                ...variables,
                groupId: variables.groupId ?? getActiveGroupId(),
                splitId: variables.splitId || createClientId('split'),
                timestamp: variables.timestamp || new Date().toISOString(),
            };
            preparedSplitMap.delete(variables);

            enqueueOfflineMutation('ADD_SPLIT', payload);

            setTimeout(() => {
                processOfflineQueue(queryClient).catch((err) => {
                    console.warn('[Queue] Background sync error for ADD_SPLIT:', err);
                });
            }, 50);

            return { ...createOptimisticSplit(payload), offline: true };
        },
        onMutate: async (newSplitPayload) => {
            const groupId = newSplitPayload.groupId ?? getActiveGroupId();
            const prepared: AddSplitPayload = {
                ...newSplitPayload,
                groupId,
                splitId: newSplitPayload.splitId || createClientId('split'),
                timestamp: newSplitPayload.timestamp || new Date().toISOString(),
            };
            preparedSplitMap.set(newSplitPayload, prepared);

            const previousSplits = queryClient.getQueriesData<Split[]>({ queryKey: ['splits'] });
            const spendingsKey = queryKeys.spendings(prepared.paidBy, groupId);
            const prevSpendings = prepared.recordExpense
                ? queryClient.getQueryData<SpendingsData>(spendingsKey)
                : undefined;

            await queryClient.cancelQueries({ queryKey: ['splits'] });
            await queryClient.cancelQueries({ queryKey: ['spendings'] });

            const optimisticSplit = createOptimisticSplit(prepared);

            // Optimistically update all matching splits queries (respecting status/person filters)
            applySplitAddToCaches(queryClient, optimisticSplit);

            // Optimistically update spendings if recordExpense is true
            if (prepared.recordExpense && prevSpendings) {
                const splitRecord: ExpenseRecord = {
                    category: prepared.category,
                    amount: prepared.amount,
                    description: `${prepared.description} (Split: ${optimisticSplit.splitId})`,
                    timestamp: prepared.timestamp,
                    isSplitRow: true,
                };
                queryClient.setQueryData<SpendingsData>(spendingsKey, {
                    ...prevSpendings,
                    today: prevSpendings.today + prepared.amount,
                    currentMonth: prevSpendings.currentMonth + prepared.amount,
                    total: prevSpendings.total + prepared.amount,
                    ...(typeof prevSpendings.splitRecordedTotal === 'number'
                        ? { splitRecordedTotal: prevSpendings.splitRecordedTotal + prepared.amount }
                        : {}),
                    todayExpensesCount: prevSpendings.todayExpensesCount + 1,
                    totalExpensesCount: prevSpendings.totalExpensesCount + 1,
                    recentExpenses: [splitRecord, ...(prevSpendings.recentExpenses || [])],
                    ...(prevSpendings.allExpenses
                        ? { allExpenses: [splitRecord, ...prevSpendings.allExpenses] }
                        : {}),
                });
            }

            return { optimisticSplit, previousSplits, prevSpendings, spendingsKey };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousSplits) {
                for (const [key, data] of context.previousSplits) {
                    queryClient.setQueryData(key, data);
                }
            }
            if (context?.spendingsKey && context.prevSpendings !== undefined) {
                queryClient.setQueryData(context.spendingsKey, context.prevSpendings);
            }
        },
        onSuccess: () => {
            // Optimistic state is safely rendered and stored in IndexedDB.
            // Canonical data is updated when processOfflineQueue succeeds in background.
        },
    });
}

// 3. ADD CONTRIBUTION MUTATION WITH WRITE-AHEAD QUEUE
export function useAddContributionMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        networkMode: 'always',
        mutationFn: async ({ splitId, groupId, person, amount }: AddContributionPayload) => {
            const payload: AddContributionPayload = {
                splitId,
                groupId: groupId ?? getActiveGroupId(),
                person,
                amount,
            };
            enqueueOfflineMutation('ADD_CONTRIBUTION', payload);

            setTimeout(() => {
                processOfflineQueue(queryClient).catch((err) => {
                    console.warn('[Queue] Background sync error for ADD_CONTRIBUTION:', err);
                });
            }, 50);

            return { splitId, offline: true } as Split & { offline?: boolean };
        },
        onMutate: async (newContribution) => {
            const groupId = newContribution.groupId ?? getActiveGroupId();
            const detailKey = queryKeys.splitDetails(newContribution.splitId, groupId);
            const previousSplits = queryClient.getQueriesData<Split[]>({ queryKey: ['splits'] });
            const previousSplitDetail = queryClient.getQueryData<Split>(detailKey);
            await queryClient.cancelQueries({ queryKey: ['splits'] });
            await queryClient.cancelQueries({ queryKey: detailKey });

            applySplitTransformToCaches(
                queryClient,
                newContribution.splitId,
                (s) => ({
                    ...s,
                    contributions: [
                        ...(s.contributions || []),
                        { person: newContribution.person, amount: newContribution.amount },
                    ],
                }),
                undefined,
                groupId
            );
            return { previousSplits, detailKey, previousSplitDetail };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousSplits) {
                for (const [key, data] of context.previousSplits) {
                    queryClient.setQueryData(key, data);
                }
            }
            if (context?.detailKey && context.previousSplitDetail !== undefined) {
                queryClient.setQueryData(context.detailKey, context.previousSplitDetail);
            }
        },
        onSuccess: () => {
            // Handled when processOfflineQueue invalidates queries
        },
    });
}

// 4. SETTLE PARTICIPANT MUTATION WITH WRITE-AHEAD QUEUE
export function useSettleParticipantMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        networkMode: 'always',
        mutationFn: async (variables: SettleParticipantPayload) => {
            const payload: SettleParticipantPayload = {
                ...variables,
                groupId: variables.groupId ?? getActiveGroupId(),
            };
            enqueueOfflineMutation('SETTLE_PARTICIPANT', payload);

            setTimeout(() => {
                processOfflineQueue(queryClient).catch((err) => {
                    console.warn('[Queue] Background sync error for SETTLE_PARTICIPANT:', err);
                });
            }, 50);

            return { splitId: payload.splitId, offline: true } as Split & { offline?: boolean };
        },
        onMutate: async (variables) => {
            const groupId = variables.groupId ?? getActiveGroupId();
            const detailKey = queryKeys.splitDetails(variables.splitId, groupId);
            const previousSplits = queryClient.getQueriesData<Split[]>({ queryKey: ['splits'] });
            const previousSplitDetail = queryClient.getQueryData<Split>(detailKey);
            await queryClient.cancelQueries({ queryKey: ['splits'] });
            await queryClient.cancelQueries({ queryKey: detailKey });

            // Optimistically update splits and detail caches cleanly across status filters
            applySplitTransformToCaches(
                queryClient,
                variables.splitId,
                (s) => withSettlementStatus(s, variables.from, variables.to, variables.settled !== false),
                undefined,
                groupId
            );
            return { previousSplits, detailKey, previousSplitDetail };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousSplits) {
                for (const [key, data] of context.previousSplits) {
                    queryClient.setQueryData(key, data);
                }
            }
            if (context?.detailKey && context.previousSplitDetail !== undefined) {
                queryClient.setQueryData(context.detailKey, context.previousSplitDetail);
            }
        },
        onSuccess: () => {
            // Handled when processOfflineQueue invalidates queries
        },
    });
}

// 5. UPDATE UPI MUTATION WITH WRITE-AHEAD QUEUE
export function useUpdateUpiMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        networkMode: 'always',
        mutationFn: async (variables: UpdateUpiPayload) => {
            const { name, upiId, requestedBy } = variables;
            const groupId = variables.groupId ?? getActiveGroupId();
            const previousUpiId = previousUpiMap.get(variables);
            previousUpiMap.delete(variables);

            const payload = { name, upiId, groupId, requestedBy, previousUpiId };
            enqueueOfflineMutation('UPDATE_UPI', payload);

            setTimeout(() => {
                processOfflineQueue(queryClient).catch((err) => {
                    console.warn('[Queue] Background sync error for UPDATE_UPI:', err);
                });
            }, 50);

            return { message: 'UPI saved locally and queued for sync', status: 'queued', offline: true };
        },
        onMutate: async (variables) => {
            const { name, upiId } = variables;
            const groupId = variables.groupId ?? getActiveGroupId();
            const peopleKey = queryKeys.peopleDetails(groupId);
            const prevPeople = queryClient.getQueryData<{ name: string; upiId?: string | null }[]>(peopleKey);
            const prevPerson = prevPeople?.find(
                (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()
            );
            previousUpiMap.set(variables, prevPerson?.upiId ?? undefined);

            await queryClient.cancelQueries({ queryKey: peopleKey });

            queryClient.setQueriesData<{ name: string; upiId?: string | null }[]>(
                { queryKey: peopleKey },
                (old) => {
                    if (!old) return old;
                    return old.map((p) => {
                        if (p.name.trim().toLowerCase() === name.trim().toLowerCase()) {
                            return { ...p, upiId };
                        }
                        return p;
                    });
                }
            );

            return { prevPeople, peopleKey };
        },
        onError: (_err, _vars, context) => {
            if (context?.peopleKey && context.prevPeople !== undefined) {
                queryClient.setQueryData(context.peopleKey, context.prevPeople);
            }
        },
        onSuccess: () => {
            // Handled when processOfflineQueue invalidates queries
        },
    });
}

// 6. DELETE SPLIT MUTATION WITH WRITE-AHEAD QUEUE
export function useDeleteSplitMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        networkMode: 'always',
        mutationFn: async (variables: { splitId: string; groupId?: string | null; requestedBy?: string }) => {
            const { splitId, requestedBy } = variables;
            const groupId = variables.groupId ?? getActiveGroupId();
            const previousSplit = previousDeletedSplitMap.get(variables);
            previousDeletedSplitMap.delete(variables);

            const payload = { splitId, groupId, requestedBy, previousSplit };
            enqueueOfflineMutation('DELETE_SPLIT', payload);

            setTimeout(() => {
                processOfflineQueue(queryClient).catch((err) => {
                    console.warn('[Queue] Background sync error for DELETE_SPLIT:', err);
                });
            }, 50);

            return { success: true, message: `Split ${splitId} deleted locally`, offline: true };
        },
        onMutate: async (variables) => {
            const { splitId } = variables;
            const groupId = variables.groupId ?? getActiveGroupId();
            const detailKey = queryKeys.splitDetails(splitId, groupId);
            const previousSplits = queryClient.getQueriesData<Split[]>({ queryKey: ['splits'] });
            const previousSplitDetail = queryClient.getQueryData<Split>(detailKey);
            const previousSplit = findCachedSplitById(queryClient, splitId, groupId);
            previousDeletedSplitMap.set(variables, previousSplit);

            await queryClient.cancelQueries({ queryKey: ['splits'] });
            await queryClient.cancelQueries({ queryKey: detailKey });

            // Optimistically remove deleted split from all matching splits caches & detail cache
            applySplitRemoveToCaches(queryClient, splitId, groupId);

            return { previousSplits, detailKey, previousSplitDetail };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousSplits) {
                for (const [key, data] of context.previousSplits) {
                    queryClient.setQueryData(key, data);
                }
            }
            if (context?.detailKey && context.previousSplitDetail !== undefined) {
                queryClient.setQueryData(context.detailKey, context.previousSplitDetail);
            }
        },
        onSuccess: () => {
            // Handled when processOfflineQueue invalidates queries
        },
    });
}

// 7. UPDATE SPLIT MUTATION WITH WRITE-AHEAD QUEUE
export function useUpdateSplitMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        networkMode: 'always',
        mutationFn: async (variables: UpdateSplitPayload) => {
            const groupId = variables.groupId ?? getActiveGroupId();
            const previousSplit = previousUpdatedSplitMap.get(variables);
            previousUpdatedSplitMap.delete(variables);

            enqueueOfflineMutation('UPDATE_SPLIT', { ...variables, groupId, previousSplit });

            setTimeout(() => {
                processOfflineQueue(queryClient).catch((err) => {
                    console.warn('[Queue] Background sync error for UPDATE_SPLIT:', err);
                });
            }, 50);

            return { success: true, data: variables as unknown as Split, offline: true };
        },
        onMutate: async (payload) => {
            const groupId = payload.groupId ?? getActiveGroupId();
            const detailKey = queryKeys.splitDetails(payload.splitId, groupId);
            const previousSplits = queryClient.getQueriesData<Split[]>({ queryKey: ['splits'] });
            const previousSplitDetail = queryClient.getQueryData<Split>(detailKey);
            const previousSplit = findCachedSplitById(queryClient, payload.splitId, groupId);
            previousUpdatedSplitMap.set(payload, previousSplit);

            await queryClient.cancelQueries({ queryKey: ['splits'] });
            await queryClient.cancelQueries({ queryKey: detailKey });

            // Optimistically update split across list and detail caches
            applySplitTransformToCaches(
                queryClient,
                payload.splitId,
                (s) => withUpdatedSplitFields(s, payload),
                undefined,
                groupId
            );

            return { previousSplits, detailKey, previousSplitDetail };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousSplits) {
                for (const [key, data] of context.previousSplits) {
                    queryClient.setQueryData(key, data);
                }
            }
            if (context?.detailKey && context.previousSplitDetail !== undefined) {
                queryClient.setQueryData(context.detailKey, context.previousSplitDetail);
            }
        },
        onSuccess: () => {
            // Handled when processOfflineQueue invalidates queries
        },
    });
}
