import type { QueryClient } from '@tanstack/react-query';
import type { QueuedItem } from './offlineQueue';
import type {
    AddExpensePayload,
    AddSplitPayload,
    AddContributionPayload,
    SettleParticipantPayload,
    UpdateUpiPayload,
    UpdateSplitPayload,
    Split,
    SpendingsData,
} from '../api/types';
import { queryKeys } from '../api/queries';

/**
 * Rolls back an optimistic mutation from QueryClient cache when it is cancelled/discarded from queue.
 * Updates both memory cache and triggers automatic IndexedDB re-persistence.
 */
export function rollbackMutationInQueryCache(item: QueuedItem, queryClient: QueryClient): void {
    try {
        switch (item.type) {
            case 'ADD_SPLIT': {
                const p = item.payload as AddSplitPayload;
                const splitId = p.splitId || item.splitId || item.id;

                // 1. Remove the optimistic split from all splits queries
                queryClient.setQueriesData<Split[]>({ queryKey: ['splits'] }, (old) => {
                    if (!old) return old;
                    return old.filter((s) => s.splitId !== splitId);
                });

                // 2. If recordExpense was enabled, deduct from payee's spendings
                if (p.recordExpense && p.paidBy) {
                    const spendingsKey = queryKeys.spendings(p.paidBy);
                    queryClient.setQueriesData<SpendingsData>(
                        { queryKey: spendingsKey },
                        (old) => {
                            if (!old) return old;
                            let removed = false;
                            const recentExpenses = (old.recentExpenses || []).filter((e) => {
                                if (!removed && e.amount === p.amount && (!p.description || e.description === p.description)) {
                                    removed = true;
                                    return false;
                                }
                                return true;
                            });
                            return {
                                ...old,
                                today: Math.max(0, old.today - p.amount),
                                currentMonth: Math.max(0, old.currentMonth - p.amount),
                                total: Math.max(0, old.total - p.amount),
                                todayExpensesCount: Math.max(0, (old.todayExpensesCount || 1) - 1),
                                totalExpensesCount: Math.max(0, (old.totalExpensesCount || 1) - 1),
                                recentExpenses,
                            };
                        }
                    );
                }
                break;
            }

            case 'ADD_EXPENSE': {
                const p = item.payload as AddExpensePayload;
                if (p.payee) {
                    const spendingsKey = queryKeys.spendings(p.payee);
                    queryClient.setQueriesData<SpendingsData>(
                        { queryKey: spendingsKey },
                        (old) => {
                            if (!old) return old;
                            let removed = false;
                            const recentExpenses = (old.recentExpenses || []).filter((e) => {
                                if (!removed && e.amount === p.amount && (!p.description || e.description === p.description)) {
                                    removed = true;
                                    return false;
                                }
                                return true;
                            });
                            return {
                                ...old,
                                today: Math.max(0, old.today - p.amount),
                                currentMonth: Math.max(0, old.currentMonth - p.amount),
                                total: Math.max(0, old.total - p.amount),
                                todayExpensesCount: Math.max(0, (old.todayExpensesCount || 1) - 1),
                                totalExpensesCount: Math.max(0, (old.totalExpensesCount || 1) - 1),
                                recentExpenses,
                            };
                        }
                    );
                }
                break;
            }

            case 'ADD_CONTRIBUTION': {
                const p = item.payload as AddContributionPayload;
                queryClient.setQueriesData<Split[]>({ queryKey: ['splits'] }, (old) => {
                    if (!old) return old;
                    return old.map((s) => {
                        if (s.splitId !== p.splitId) return s;
                        let removed = false;
                        const contributions = (s.contributions || []).filter((c) => {
                            if (!removed && c.person === p.person && c.amount === p.amount) {
                                removed = true;
                                return false;
                            }
                            return true;
                        });
                        return {
                            ...s,
                            contributions,
                        };
                    });
                });
                break;
            }

            case 'SETTLE_PARTICIPANT': {
                const p = item.payload as SettleParticipantPayload;
                queryClient.setQueriesData<Split[]>({ queryKey: ['splits'] }, (old) => {
                    if (!old) return old;
                    return old.map((s) => {
                        if (s.splitId !== p.splitId) return s;
                        const settlements = s.settlements.map((settle) => {
                            const match =
                                settle.from.trim().toLowerCase() === p.from.trim().toLowerCase() &&
                                (!p.to || settle.to.trim().toLowerCase() === p.to.trim().toLowerCase());
                            if (match) {
                                return { ...settle, status: 'PENDING' as const };
                            }
                            return settle;
                        });
                        return {
                            ...s,
                            settlements,
                            status: 'ACTIVE' as const,
                        };
                    });
                });
                break;
            }

            case 'DELETE_SPLIT': {
                const p = item.payload as { splitId: string; previousSplit?: Split };
                if (p.previousSplit) {
                    queryClient.setQueriesData<Split[]>({ queryKey: ['splits'] }, (old = []) => {
                        if (old.some((s) => s.splitId === p.splitId)) return old;
                        return [p.previousSplit!, ...old];
                    });
                }
                break;
            }

            case 'UPDATE_SPLIT': {
                const p = item.payload as UpdateSplitPayload & { previousSplit?: Split };
                if (p.previousSplit) {
                    queryClient.setQueriesData<Split[]>({ queryKey: ['splits'] }, (old = []) => {
                        return old.map((s) => (s.splitId === p.splitId ? p.previousSplit! : s));
                    });
                }
                break;
            }

            case 'UPDATE_UPI': {
                const p = item.payload as UpdateUpiPayload & { previousUpiId?: string };
                if (p.previousUpiId !== undefined) {
                    queryClient.setQueriesData<{ name: string; upiId?: string }[]>(
                        { queryKey: queryKeys.peopleDetails() },
                        (old) => {
                            if (!old) return old;
                            return old.map((person) => {
                                if (person.name.trim().toLowerCase() === p.name.trim().toLowerCase()) {
                                    return { ...person, upiId: p.previousUpiId };
                                }
                                return person;
                            });
                        }
                    );
                }
                break;
            }
        }
    } catch (err) {
        console.warn('[OfflineRollback] Failed to rollback mutation in cache:', err);
    }
}

