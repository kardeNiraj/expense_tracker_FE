import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queries';
import {
    enqueueOfflineMutation,
    processOfflineQueue,
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

    const splitId =
        payload.splitId ||
        `split_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return {
        splitId,
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

// 1. ADD EXPENSE MUTATION WITH WRITE-AHEAD QUEUE & OPTIMISTIC UI
export function useAddExpenseMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        networkMode: 'always',
        mutationFn: async (payload: AddExpensePayload) => {
            // Write-Ahead Queue: Always serialize to local queue first
            enqueueOfflineMutation('ADD_EXPENSE', payload);

            // Trigger background processing with auto-retry
            setTimeout(() => {
                processOfflineQueue(queryClient).catch((err) => {
                    console.warn('[Queue] Background sync error for ADD_EXPENSE:', err);
                });
            }, 50);

            return { message: 'Saved and queued for sync', status: 'queued', offline: true };
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
        mutationFn: async (payload: AddSplitPayload) => {
            if (!payload.splitId) {
                payload.splitId = `split_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            }

            // Write-Ahead Queue: Always serialize to local queue first
            enqueueOfflineMutation('ADD_SPLIT', payload);

            // Trigger background processing with auto-retry
            setTimeout(() => {
                processOfflineQueue(queryClient).catch((err) => {
                    console.warn('[Queue] Background sync error for ADD_SPLIT:', err);
                });
            }, 50);

            return { ...createOptimisticSplit(payload), offline: true };
        },
        onMutate: async (newSplitPayload) => {
            if (!newSplitPayload.splitId) {
                newSplitPayload.splitId = `split_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            }

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
        mutationFn: async ({ splitId, person, amount }: AddContributionPayload) => {
            const payload: AddContributionPayload = { splitId, person, amount };
            enqueueOfflineMutation('ADD_CONTRIBUTION', payload);

            setTimeout(() => {
                processOfflineQueue(queryClient).catch((err) => {
                    console.warn('[Queue] Background sync error for ADD_CONTRIBUTION:', err);
                });
            }, 50);

            return { splitId, offline: true } as Split & { offline?: boolean };
        },
        onMutate: async (newContribution) => {
            await queryClient.cancelQueries({ queryKey: ['splits'] });
            queryClient.setQueriesData<Split[]>({ queryKey: ['splits'] }, (old) => {
                if (!old) return old;
                return old.map((s) => {
                    if (s.splitId !== newContribution.splitId) return s;
                    return {
                        ...s,
                        contributions: [
                            ...(s.contributions || []),
                            { person: newContribution.person, amount: newContribution.amount },
                        ],
                    };
                });
            });
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
        mutationFn: async (payload: SettleParticipantPayload) => {
            enqueueOfflineMutation('SETTLE_PARTICIPANT', payload);

            setTimeout(() => {
                processOfflineQueue(queryClient).catch((err) => {
                    console.warn('[Queue] Background sync error for SETTLE_PARTICIPANT:', err);
                });
            }, 50);

            return { splitId: payload.splitId, offline: true } as Split & { offline?: boolean };
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
                            settle.from.trim().toLowerCase() === variables.from.trim().toLowerCase() &&
                            (!variables.to || settle.to.trim().toLowerCase() === variables.to.trim().toLowerCase());
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
        onSuccess: () => {
            // Handled when processOfflineQueue invalidates queries
        },
    });
}

// 5. UPDATE UPI MUTATION WITH WRITE-AHEAD QUEUE
let lastPreviousUpiId: string | undefined;

export function useUpdateUpiMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        networkMode: 'always',
        mutationFn: async ({ name, upiId, requestedBy }: UpdateUpiPayload) => {
            const payload = { name, upiId, requestedBy, previousUpiId: lastPreviousUpiId };
            enqueueOfflineMutation('UPDATE_UPI', payload);

            setTimeout(() => {
                processOfflineQueue(queryClient).catch((err) => {
                    console.warn('[Queue] Background sync error for UPDATE_UPI:', err);
                });
            }, 50);

            return { message: 'UPI saved locally and queued for sync', status: 'queued', offline: true };
        },
        onMutate: async ({ name, upiId }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.peopleDetails() });

            const people = queryClient.getQueryData<{ name: string; upiId?: string }[]>(queryKeys.peopleDetails());
            const prevPerson = people?.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
            lastPreviousUpiId = prevPerson?.upiId;

            queryClient.setQueriesData<{ name: string; upiId?: string }[]>(
                { queryKey: queryKeys.peopleDetails() },
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
        },
        onSuccess: () => {
            // Handled when processOfflineQueue invalidates queries
        },
    });
}

// 6. DELETE SPLIT MUTATION WITH WRITE-AHEAD QUEUE
let lastDeletedSplit: Split | undefined;

export function useDeleteSplitMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        networkMode: 'always',
        mutationFn: async ({ splitId, requestedBy }: { splitId: string; requestedBy?: string }) => {
            const payload = { splitId, requestedBy, previousSplit: lastDeletedSplit };
            enqueueOfflineMutation('DELETE_SPLIT', payload);

            setTimeout(() => {
                processOfflineQueue(queryClient).catch((err) => {
                    console.warn('[Queue] Background sync error for DELETE_SPLIT:', err);
                });
            }, 50);

            return { success: true, message: `Split ${splitId} deleted locally`, offline: true };
        },
        onMutate: async ({ splitId }) => {
            await queryClient.cancelQueries({ queryKey: ['splits'] });

            const splitsQueries = queryClient.getQueriesData<Split[]>({ queryKey: ['splits'] });
            let previousSplit: Split | undefined;
            for (const [, splits] of splitsQueries) {
                const found = splits?.find((s) => s.splitId === splitId);
                if (found) {
                    previousSplit = found;
                    break;
                }
            }
            lastDeletedSplit = previousSplit;

            // Optimistically filter out deleted split from cache
            queryClient.setQueriesData<Split[]>({ queryKey: ['splits'] }, (old) => {
                if (!old) return old;
                return old.filter((s) => s.splitId !== splitId);
            });
        },
        onSuccess: () => {
            // Handled when processOfflineQueue invalidates queries
        },
    });
}

// 7. UPDATE SPLIT MUTATION WITH WRITE-AHEAD QUEUE
let lastUpdatedSplit: Split | undefined;

export function useUpdateSplitMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        networkMode: 'always',
        mutationFn: async (payload: UpdateSplitPayload) => {
            enqueueOfflineMutation('UPDATE_SPLIT', { ...payload, previousSplit: lastUpdatedSplit });

            setTimeout(() => {
                processOfflineQueue(queryClient).catch((err) => {
                    console.warn('[Queue] Background sync error for UPDATE_SPLIT:', err);
                });
            }, 50);

            return { success: true, data: payload as unknown as Split, offline: true };
        },
        onMutate: async (payload) => {
            await queryClient.cancelQueries({ queryKey: ['splits'] });

            const splitsQueries = queryClient.getQueriesData<Split[]>({ queryKey: ['splits'] });
            let previousSplit: Split | undefined;
            for (const [, splits] of splitsQueries) {
                const found = splits?.find((s) => s.splitId === payload.splitId);
                if (found) {
                    previousSplit = found;
                    break;
                }
            }
            lastUpdatedSplit = previousSplit;

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
        onSuccess: () => {
            // Handled when processOfflineQueue invalidates queries
        },
    });
}

