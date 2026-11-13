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
import {
    applySplitAddToCaches,
    applySplitRemoveToCaches,
    applySplitTransformToCaches,
    withSettlementStatus,
} from './splitCacheHelpers';

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

                // 1. Remove the optimistic split from all matching splits queries
                applySplitRemoveToCaches(queryClient, splitId, p.groupId);

                // 2. If recordExpense was enabled, deduct from payee's spendings
                if (p.recordExpense && p.paidBy) {
                    const spendingsKey = queryKeys.spendings(p.paidBy, p.groupId);
                    const splitTag = `(split: ${splitId})`.toLowerCase();
                    const matchesSplitExpense = (e: { amount: number; description?: string; timestamp?: string }) => {
                        if (e.description?.toLowerCase().includes(splitTag)) return true;
                        if (p.timestamp && e.timestamp && e.timestamp === p.timestamp && e.amount === p.amount) {
                            return true;
                        }
                        return e.amount === p.amount && (!p.description || e.description === p.description);
                    };

                    queryClient.setQueriesData<SpendingsData>(
                        { queryKey: spendingsKey },
                        (old) => {
                            if (!old) return old;
                            let removedRecent = false;
                            const recentExpenses = (old.recentExpenses || []).filter((e) => {
                                if (!removedRecent && matchesSplitExpense(e)) {
                                    removedRecent = true;
                                    return false;
                                }
                                return true;
                            });
                            let removedAll = false;
                            const allExpenses = old.allExpenses
                                ? old.allExpenses.filter((e) => {
                                      if (!removedAll && matchesSplitExpense(e)) {
                                          removedAll = true;
                                          return false;
                                      }
                                      return true;
                                  })
                                : undefined;

                            return {
                                ...old,
                                today: Math.max(0, old.today - p.amount),
                                currentMonth: Math.max(0, old.currentMonth - p.amount),
                                total: Math.max(0, old.total - p.amount),
                                ...(typeof old.splitRecordedTotal === 'number'
                                    ? { splitRecordedTotal: Math.max(0, old.splitRecordedTotal - p.amount) }
                                    : {}),
                                todayExpensesCount: Math.max(0, (old.todayExpensesCount || 1) - 1),
                                totalExpensesCount: Math.max(0, (old.totalExpensesCount || 1) - 1),
                                recentExpenses,
                                ...(allExpenses !== undefined ? { allExpenses } : {}),
                            };
                        }
                    );
                }
                break;
            }

            case 'ADD_EXPENSE': {
                const p = item.payload as AddExpensePayload;
                if (p.payee) {
                    const spendingsKey = queryKeys.spendings(p.payee, p.groupId);
                    const matchesDirectExpense = (e: {
                        amount: number;
                        description?: string;
                        timestamp?: string;
                        isSplitRow?: boolean;
                    }) => {
                        if (e.isSplitRow) return false;
                        if (p.timestamp && e.timestamp && e.timestamp === p.timestamp && e.amount === p.amount) {
                            return true;
                        }
                        return e.amount === p.amount && (!p.description || e.description === p.description);
                    };

                    queryClient.setQueriesData<SpendingsData>(
                        { queryKey: spendingsKey },
                        (old) => {
                            if (!old) return old;
                            let removedRecent = false;
                            const recentExpenses = (old.recentExpenses || []).filter((e) => {
                                if (!removedRecent && matchesDirectExpense(e)) {
                                    removedRecent = true;
                                    return false;
                                }
                                return true;
                            });
                            let removedAll = false;
                            const allExpenses = old.allExpenses
                                ? old.allExpenses.filter((e) => {
                                      if (!removedAll && matchesDirectExpense(e)) {
                                          removedAll = true;
                                          return false;
                                      }
                                      return true;
                                  })
                                : undefined;

                            return {
                                ...old,
                                today: Math.max(0, old.today - p.amount),
                                currentMonth: Math.max(0, old.currentMonth - p.amount),
                                total: Math.max(0, old.total - p.amount),
                                ...(typeof old.directToday === 'number'
                                    ? { directToday: Math.max(0, old.directToday - p.amount) }
                                    : {}),
                                ...(typeof old.directCurrentMonth === 'number'
                                    ? { directCurrentMonth: Math.max(0, old.directCurrentMonth - p.amount) }
                                    : {}),
                                ...(typeof old.directTotal === 'number'
                                    ? { directTotal: Math.max(0, old.directTotal - p.amount) }
                                    : {}),
                                ...(typeof old.directExpensesCount === 'number'
                                    ? { directExpensesCount: Math.max(0, old.directExpensesCount - 1) }
                                    : {}),
                                todayExpensesCount: Math.max(0, (old.todayExpensesCount || 1) - 1),
                                totalExpensesCount: Math.max(0, (old.totalExpensesCount || 1) - 1),
                                recentExpenses,
                                ...(allExpenses !== undefined ? { allExpenses } : {}),
                            };
                        }
                    );
                }
                break;
            }

            case 'ADD_CONTRIBUTION': {
                const p = item.payload as AddContributionPayload;
                applySplitTransformToCaches(queryClient, p.splitId, (s) => {
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
                }, undefined, p.groupId);
                break;
            }

            case 'SETTLE_PARTICIPANT': {
                const p = item.payload as SettleParticipantPayload;
                applySplitTransformToCaches(
                    queryClient,
                    p.splitId,
                    (s) => withSettlementStatus(s, p.from, p.to, p.settled === false),
                    undefined,
                    p.groupId
                );
                break;
            }

            case 'DELETE_SPLIT': {
                const p = item.payload as { splitId: string; groupId?: string | null; previousSplit?: Split };
                if (p.previousSplit) {
                    applySplitAddToCaches(queryClient, p.previousSplit);
                }
                break;
            }

            case 'UPDATE_SPLIT': {
                const p = item.payload as UpdateSplitPayload & { previousSplit?: Split };
                if (p.previousSplit) {
                    const revertedSplit = p.previousSplit;
                    applySplitTransformToCaches(
                        queryClient,
                        p.splitId,
                        () => revertedSplit,
                        revertedSplit,
                        p.groupId
                    );
                }
                break;
            }

            case 'UPDATE_UPI': {
                const p = item.payload as UpdateUpiPayload & { previousUpiId?: string };
                if (p.previousUpiId !== undefined) {
                    queryClient.setQueriesData<{ name: string; upiId?: string }[]>(
                        { queryKey: queryKeys.peopleDetails(p.groupId) },
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

