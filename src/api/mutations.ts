import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import { queryKeys } from './queries';
import {
    enqueueOfflineMutation,
    isOfflineOrNetworkError,
} from '../utils/offlineQueue';
import type {
    AddExpensePayload,
    AddSplitPayload,
    AddContributionPayload,
    SettleParticipantPayload,
    UpdateUpiPayload,
    UpdateSplitPayload,
    Split,
    SpendingsData,
} from './types';

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

    return {
        splitId: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        description: payload.description,
        category: payload.category,
        totalAmount: payload.amount,
        paidBy: payload.paidBy,
        createdBy: payload.createdBy,
        participants: payload.participants,
        contributions: payload.contributions || [],
        settlements,
        status: 'ACTIVE',
        timestamp: new Date().toISOString(),
    };
}

// 1. ADD EXPENSE MUTATION WITH OPTIMISTIC UI & OFFLINE QUEUE
export function useAddExpenseMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: AddExpensePayload) => {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                enqueueOfflineMutation('ADD_EXPENSE', payload);
                return { message: 'Saved offline', status: 'offline', offline: true };
            }

            try {
                return await apiFetch<{ message?: string; status?: string }>('/add-expense', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
            } catch (err: unknown) {
                if (isOfflineOrNetworkError(err)) {
                    enqueueOfflineMutation('ADD_EXPENSE', payload);
                    return { message: 'Saved offline', status: 'offline', offline: true };
                }
                throw err;
            }
        },
        onMutate: async (newExpense) => {
            await queryClient.cancelQueries({ queryKey: ['spendings'] });

            const spendingsKey = queryKeys.spendings(newExpense.payee);
            const prevSpendings = queryClient.getQueryData<SpendingsData>(spendingsKey);

            if (prevSpendings) {
                queryClient.setQueryData<SpendingsData>(spendingsKey, {
                    ...prevSpendings,
                    today: prevSpendings.today + newExpense.amount,
                    currentMonth: prevSpendings.currentMonth + newExpense.amount,
                    total: prevSpendings.total + newExpense.amount,
                    todayExpensesCount: prevSpendings.todayExpensesCount + 1,
                    totalExpensesCount: prevSpendings.totalExpensesCount + 1,
                    recentExpenses: [
                        {
                            category: newExpense.category,
                            amount: newExpense.amount,
                            description: newExpense.description,
                            timestamp: new Date().toISOString(),
                        },
                        ...prevSpendings.recentExpenses,
                    ],
                });
            }

            return { prevSpendings, spendingsKey };
        },
        onError: (_err, _vars, context) => {
            if (context?.prevSpendings && context?.spendingsKey) {
                queryClient.setQueryData(context.spendingsKey, context.prevSpendings);
            }
        },
        onSuccess: (data, variables) => {
            // Only invalidate if synced online; keep optimistic cache if offline
            if (!(data as { offline?: boolean })?.offline) {
                queryClient.invalidateQueries({ queryKey: queryKeys.spendings(variables.payee) });
                queryClient.invalidateQueries({ queryKey: ['spendings'] });
                queryClient.invalidateQueries({ queryKey: ['splits'] });
            }
        },
    });
}

// 2. ADD SPLIT MUTATION WITH OPTIMISTIC UI & OFFLINE QUEUE
export function useAddSplitMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: AddSplitPayload) => {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                enqueueOfflineMutation('ADD_SPLIT', payload);
                return createOptimisticSplit(payload);
            }

            try {
                return await apiFetch<Split>('/split', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
            } catch (err: unknown) {
                if (isOfflineOrNetworkError(err)) {
                    enqueueOfflineMutation('ADD_SPLIT', payload);
                    return createOptimisticSplit(payload);
                }
                throw err;
            }
        },
        onMutate: async (newSplitPayload) => {
            await queryClient.cancelQueries({ queryKey: ['splits'] });
            await queryClient.cancelQueries({ queryKey: ['spendings'] });

            const optimisticSplit = createOptimisticSplit(newSplitPayload);

            // Optimistically update all matching splits queries
            queryClient.setQueriesData<Split[]>({ queryKey: ['splits'] }, (old) => {
                if (!old) return [optimisticSplit];
                return [optimisticSplit, ...old];
            });

            // Optimistically update spendings if recordExpense is true
            if (newSplitPayload.recordExpense) {
                const spendingsKey = queryKeys.spendings(newSplitPayload.paidBy);
                const prevSpendings = queryClient.getQueryData<SpendingsData>(spendingsKey);

                if (prevSpendings) {
                    queryClient.setQueryData<SpendingsData>(spendingsKey, {
                        ...prevSpendings,
                        today: prevSpendings.today + newSplitPayload.amount,
                        currentMonth: prevSpendings.currentMonth + newSplitPayload.amount,
                        total: prevSpendings.total + newSplitPayload.amount,
                        todayExpensesCount: prevSpendings.todayExpensesCount + 1,
                        totalExpensesCount: prevSpendings.totalExpensesCount + 1,
                        recentExpenses: [
                            {
                                category: newSplitPayload.category,
                                amount: newSplitPayload.amount,
                                description: newSplitPayload.description,
                                timestamp: new Date().toISOString(),
                            },
                            ...prevSpendings.recentExpenses,
                        ],
                    });
                }
            }

            return { optimisticSplit };
        },
        onSuccess: (data, variables) => {
            if (!data.splitId.startsWith('offline_')) {
                queryClient.invalidateQueries({ queryKey: ['splits'] });
                queryClient.invalidateQueries({ queryKey: queryKeys.spendings(variables.paidBy) });
                queryClient.invalidateQueries({ queryKey: ['spendings'] });
            }
        },
    });
}

// 3. ADD CONTRIBUTION MUTATION
export function useAddContributionMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ splitId, person, amount }: AddContributionPayload) => {
            const payload: AddContributionPayload = { splitId, person, amount };

            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                enqueueOfflineMutation('ADD_CONTRIBUTION', payload);
                return { splitId } as Split;
            }

            try {
                return await apiFetch<Split>(`/split/${splitId}/contributions`, {
                    method: 'POST',
                    body: JSON.stringify({ person, amount }),
                });
            } catch (err: unknown) {
                if (isOfflineOrNetworkError(err)) {
                    enqueueOfflineMutation('ADD_CONTRIBUTION', payload);
                    return { splitId } as Split;
                }
                throw err;
            }
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.splitDetails(variables.splitId) });
            queryClient.invalidateQueries({ queryKey: ['splits'] });
            queryClient.invalidateQueries({ queryKey: ['spendings'] });
        },
    });
}

// 4. SETTLE PARTICIPANT MUTATION WITH OPTIMISTIC UI
export function useSettleParticipantMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: SettleParticipantPayload) => {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                enqueueOfflineMutation('SETTLE_PARTICIPANT', payload);
                return { splitId: payload.splitId } as Split;
            }

            try {
                return await apiFetch<Split>(`/split/${payload.splitId}/settle`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        from: payload.from,
                        to: payload.to,
                        settled: payload.settled !== false,
                        confirmedBy: payload.confirmedBy,
                    }),
                });
            } catch (err: unknown) {
                if (isOfflineOrNetworkError(err)) {
                    enqueueOfflineMutation('SETTLE_PARTICIPANT', payload);
                    return { splitId: payload.splitId } as Split;
                }
                throw err;
            }
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: ['splits'] });

            // Optimistically update splits in cache
            queryClient.setQueriesData<Split[]>({ queryKey: ['splits'] }, (old) => {
                if (!old) return old;
                return old.map((s) => {
                    if (s.splitId !== variables.splitId) return s;

                    const updatedSettlements = s.settlements.map((settle) => {
                        const match =
                            settle.from === variables.from &&
                            (!variables.to || settle.to === variables.to);
                        if (match) {
                            return { ...settle, status: 'SETTLED' as const };
                        }
                        return settle;
                    });

                    const allSettled = updatedSettlements.every((st) => st.status === 'SETTLED');

                    return {
                        ...s,
                        settlements: updatedSettlements,
                        status: allSettled ? ('SETTLED' as const) : s.status,
                    };
                });
            });
        },
        onSuccess: (_data, variables) => {
            if (typeof navigator !== 'undefined' && navigator.onLine) {
                queryClient.invalidateQueries({ queryKey: queryKeys.splitDetails(variables.splitId) });
                queryClient.invalidateQueries({ queryKey: ['splits'] });
                queryClient.invalidateQueries({ queryKey: ['spendings'] });
            }
        },
    });
}

// 5. UPDATE UPI MUTATION
export function useUpdateUpiMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ name, upiId }: UpdateUpiPayload) => {
            const payload = { name, upiId };
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                enqueueOfflineMutation('UPDATE_UPI', payload);
                return { message: 'UPI saved offline', status: 'offline' };
            }

            try {
                return await apiFetch<{ message?: string; status?: string }>('/people/upi', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
            } catch (err: unknown) {
                if (isOfflineOrNetworkError(err)) {
                    enqueueOfflineMutation('UPDATE_UPI', payload);
                    return { message: 'UPI saved offline', status: 'offline' };
                }
                throw err;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.peopleDetails() });
        },
    });
}

// 6. DELETE SPLIT MUTATION WITH OPTIMISTIC REMOVAL
export function useDeleteSplitMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ splitId, requestedBy }: { splitId: string; requestedBy?: string }) => {
            return await apiFetch<{ success: boolean; message: string }>(
                `/split/${splitId}?requestedBy=${encodeURIComponent(requestedBy || '')}`,
                {
                    method: 'DELETE',
                }
            );
        },
        onMutate: async ({ splitId }) => {
            await queryClient.cancelQueries({ queryKey: ['splits'] });

            // Optimistically filter out deleted split from cache
            queryClient.setQueriesData<Split[]>({ queryKey: ['splits'] }, (old) => {
                if (!old) return old;
                return old.filter((s) => s.splitId !== splitId);
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['splits'] });
            queryClient.invalidateQueries({ queryKey: ['spendings'] });
        },
    });
}

// 7. UPDATE SPLIT MUTATION WITH OPTIMISTIC CACHE UPDATE
export function useUpdateSplitMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: UpdateSplitPayload) => {
            return await apiFetch<{ success: boolean; data: Split }>(`/split/${payload.splitId}`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
        },
        onMutate: async (payload) => {
            await queryClient.cancelQueries({ queryKey: ['splits'] });

            // Optimistically update split in cache
            queryClient.setQueriesData<Split[]>({ queryKey: ['splits'] }, (old) => {
                if (!old) return old;
                return old.map((s) => {
                    if (s.splitId !== payload.splitId) return s;
                    return {
                        ...s,
                        description: payload.description ?? s.description,
                        category: payload.category ?? s.category,
                        totalAmount: payload.amount ?? s.totalAmount,
                        participants: payload.participants ?? s.participants,
                    };
                });
            });
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.splitDetails(variables.splitId) });
            queryClient.invalidateQueries({ queryKey: ['splits'] });
            queryClient.invalidateQueries({ queryKey: ['spendings'] });
        },
    });
}

