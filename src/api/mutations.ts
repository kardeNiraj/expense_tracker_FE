import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import { queryKeys } from './queries';
import type {
    AddExpensePayload,
    AddSplitPayload,
    AddContributionPayload,
    SettleParticipantPayload,
    UpdateUpiPayload,
    Split,
} from './types';

export function useAddExpenseMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: AddExpensePayload) =>
            apiFetch<{ message?: string; status?: string }>('/add-expense', {
                method: 'POST',
                body: JSON.stringify(payload),
            }),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.spendings(variables.payee) });
            queryClient.invalidateQueries({ queryKey: ['spendings'] });
            queryClient.invalidateQueries({ queryKey: ['splits'] });
        },
    });
}

export function useAddSplitMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: AddSplitPayload) =>
            apiFetch<Split>('/split', {
                method: 'POST',
                body: JSON.stringify(payload),
            }),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['splits'] });
            queryClient.invalidateQueries({ queryKey: queryKeys.spendings(variables.paidBy) });
            queryClient.invalidateQueries({ queryKey: ['spendings'] });
        },
    });
}

export function useAddContributionMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ splitId, person, amount }: AddContributionPayload) =>
            apiFetch<Split>(`/split/${splitId}/contributions`, {
                method: 'POST',
                body: JSON.stringify({ person, amount }),
            }),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.splitDetails(variables.splitId) });
            queryClient.invalidateQueries({ queryKey: ['splits'] });
            queryClient.invalidateQueries({ queryKey: ['spendings'] });
        },
    });
}

export function useSettleParticipantMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ splitId, from, to, settled = true, confirmedBy }: SettleParticipantPayload) =>
            apiFetch<Split>(`/split/${splitId}/settle`, {
                method: 'PATCH',
                body: JSON.stringify({ from, to, settled, confirmedBy }),
            }),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.splitDetails(variables.splitId) });
            queryClient.invalidateQueries({ queryKey: ['splits'] });
            queryClient.invalidateQueries({ queryKey: ['spendings'] });
        },
    });
}

export function useUpdateUpiMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ name, upiId }: UpdateUpiPayload) =>
            apiFetch<{ message?: string; status?: string }>('/people/upi', {
                method: 'POST',
                body: JSON.stringify({ name, upiId }),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.peopleDetails() });
        },
    });
}
