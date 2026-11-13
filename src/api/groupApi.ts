import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type {
    AddGroupMemberPayload,
    CreateGroupInvitePayload,
    CreateGroupInviteResponse,
    CreateGroupPayload,
    GroupInvitePreview,
    GroupInviteToken,
    GroupSummary,
    JoinGroupPayload,
    JoinGroupResponse,
    RevokeGroupInviteResponse,
    UpdateGroupPayload,
    UpdateGroupStatusPayload,
} from './types';
import { getUserToken } from '../utils/authStorage';

export const groupQueryKeys = {
    all: (status?: string) => (status ? (['groups', { status }] as const) : (['groups'] as const)),
    former: () => ['groups', 'former'] as const,
    details: (groupId: string) => ['groups', 'detail', groupId] as const,
    invites: (groupId: string) => ['groups', 'invites', groupId] as const,
    invitePreview: (inviteCode: string) => ['groups', 'invite', inviteCode.trim()] as const,
};

export async function fetchGroupInvitePreviewApi(inviteCode: string): Promise<GroupInvitePreview> {
    const clean = encodeURIComponent(inviteCode.trim());
    return apiFetch<GroupInvitePreview>(`/groups/invite/${clean}`);
}

export async function fetchUserGroupsApi(status?: string): Promise<GroupSummary[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiFetch<GroupSummary[]>(`/groups${query}`);
}

export async function fetchFormerGroupsApi(): Promise<GroupSummary[]> {
    return apiFetch<GroupSummary[]>('/groups/former');
}

export async function fetchGroupDetailsApi(groupId: string): Promise<GroupSummary> {
    return apiFetch<GroupSummary>(`/groups/${encodeURIComponent(groupId)}`);
}

export async function fetchGroupInvitesApi(groupId: string): Promise<GroupInviteToken[]> {
    return apiFetch<GroupInviteToken[]>(`/groups/${encodeURIComponent(groupId)}/invites`);
}

export async function createGroupInviteApi({
    groupId,
    ...payload
}: CreateGroupInvitePayload): Promise<CreateGroupInviteResponse> {
    return apiFetch<CreateGroupInviteResponse>(
        `/groups/${encodeURIComponent(groupId)}/invites`,
        {
            method: 'POST',
            body: JSON.stringify(payload),
        }
    );
}

export async function revokeGroupInviteApi({
    groupId,
    inviteId,
}: {
    groupId: string;
    inviteId: string;
}): Promise<RevokeGroupInviteResponse> {
    return apiFetch<RevokeGroupInviteResponse>(
        `/groups/${encodeURIComponent(groupId)}/invites/${encodeURIComponent(inviteId)}`,
        {
            method: 'DELETE',
        }
    );
}

export async function createGroupApi(payload: CreateGroupPayload): Promise<GroupSummary> {
    return apiFetch<GroupSummary>('/groups', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function joinGroupApi(payload: JoinGroupPayload): Promise<JoinGroupResponse> {
    return apiFetch<JoinGroupResponse>('/groups/join', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function updateGroupApi({
    groupId,
    ...payload
}: UpdateGroupPayload): Promise<GroupSummary> {
    return apiFetch<GroupSummary>(`/groups/${encodeURIComponent(groupId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

export async function updateGroupStatusApi({
    groupId,
    status,
}: UpdateGroupStatusPayload): Promise<GroupSummary> {
    return apiFetch<GroupSummary>(`/groups/${encodeURIComponent(groupId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
}

export async function addGroupMemberApi({
    groupId,
    ...payload
}: AddGroupMemberPayload): Promise<GroupSummary> {
    return apiFetch<GroupSummary>(`/groups/${encodeURIComponent(groupId)}/members`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function removeGroupMemberApi({
    groupId,
    memberName,
}: {
    groupId: string;
    memberName: string;
}): Promise<GroupSummary> {
    return apiFetch<GroupSummary>(
        `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberName)}`,
        {
            method: 'DELETE',
        }
    );
}

export async function leaveGroupApi(groupId: string): Promise<{ left: boolean; archived?: boolean }> {
    return apiFetch<{ left: boolean; archived?: boolean }>(
        `/groups/${encodeURIComponent(groupId)}/leave`,
        {
            method: 'POST',
        }
    );
}

export function useGroupInvitePreview(inviteCode?: string | null) {
    const cleanCode = (inviteCode || '').trim();
    return useQuery<GroupInvitePreview>({
        queryKey: groupQueryKeys.invitePreview(cleanCode),
        queryFn: () => fetchGroupInvitePreviewApi(cleanCode),
        enabled: cleanCode.length >= 4,
        staleTime: 1000 * 15,
        networkMode: 'online',
        retry: 1,
    });
}

export function useGroups(enabled = true, status?: string) {
    return useQuery<GroupSummary[]>({
        queryKey: groupQueryKeys.all(status),
        queryFn: () => fetchUserGroupsApi(status),
        enabled: enabled && Boolean(getUserToken()),
        staleTime: 1000 * 30,
        networkMode: 'online',
        retry: 1,
    });
}

export function useFormerGroups(enabled = true) {
    return useQuery<GroupSummary[]>({
        queryKey: groupQueryKeys.former(),
        queryFn: fetchFormerGroupsApi,
        enabled: enabled && Boolean(getUserToken()),
        staleTime: 1000 * 30,
        networkMode: 'online',
        retry: 1,
    });
}

export function useGroupInvites(groupId?: string | null, enabled = true) {
    return useQuery<GroupInviteToken[]>({
        queryKey: groupQueryKeys.invites(groupId || ''),
        queryFn: () => fetchGroupInvitesApi(groupId || ''),
        enabled: Boolean(enabled && groupId && getUserToken()),
        staleTime: 1000 * 15,
        networkMode: 'online',
        retry: 1,
    });
}

export function useCreateGroupInviteMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createGroupInviteApi,
        onSuccess: (_data, vars) => {
            void queryClient.invalidateQueries({ queryKey: groupQueryKeys.invites(vars.groupId) });
            void queryClient.invalidateQueries({ queryKey: groupQueryKeys.all() });
            void queryClient.invalidateQueries({ queryKey: ['trip-info'] });
        },
    });
}

export function useRevokeGroupInviteMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: revokeGroupInviteApi,
        onSuccess: (_data, vars) => {
            void queryClient.invalidateQueries({ queryKey: groupQueryKeys.invites(vars.groupId) });
            void queryClient.invalidateQueries({ queryKey: groupQueryKeys.all() });
            void queryClient.invalidateQueries({ queryKey: ['trip-info'] });
        },
    });
}

export function useCreateGroupMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createGroupApi,
        onSuccess: async (created) => {
            await queryClient.cancelQueries({ queryKey: groupQueryKeys.all() });
            queryClient.setQueryData<GroupSummary[]>(groupQueryKeys.all(), (prev = []) => [
                created,
                ...prev.filter((g) => g.groupId !== created.groupId),
            ]);
            void queryClient.invalidateQueries({ queryKey: groupQueryKeys.all() });
        },
    });
}

export function useJoinGroupMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: joinGroupApi,
        onSuccess: async (res) => {
            if (res?.group?.groupId) {
                await queryClient.cancelQueries({ queryKey: groupQueryKeys.all() });
                queryClient.setQueryData<GroupSummary[]>(groupQueryKeys.all(), (prev = []) => [
                    res.group,
                    ...prev.filter((g) => g.groupId !== res.group.groupId),
                ]);
            }
            void queryClient.invalidateQueries({ queryKey: groupQueryKeys.all() });
            void queryClient.invalidateQueries({ queryKey: groupQueryKeys.former() });
            void queryClient.invalidateQueries({ queryKey: ['people'] });
            void queryClient.invalidateQueries({ queryKey: ['trip-info'] });
        },
    });
}

export function useUpdateGroupMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateGroupApi,
        onSuccess: async (updated) => {
            await queryClient.cancelQueries({ queryKey: ['groups'] });
            queryClient.setQueryData<GroupSummary[]>(groupQueryKeys.all(), (prev = []) =>
                prev.map((g) => (g.groupId === updated.groupId ? updated : g))
            );
            void queryClient.invalidateQueries({ queryKey: ['groups'] });
            void queryClient.invalidateQueries({ queryKey: ['trip-info'] });
            void queryClient.invalidateQueries({
                queryKey: groupQueryKeys.details(updated.groupId),
            });
        },
    });
}

export function useUpdateGroupStatusMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateGroupStatusApi,
        onSuccess: async (updated) => {
            await queryClient.cancelQueries({ queryKey: ['groups'] });
            queryClient.setQueryData<GroupSummary[]>(groupQueryKeys.all(), (prev = []) =>
                prev.map((g) => (g.groupId === updated.groupId ? updated : g))
            );
            void queryClient.invalidateQueries({ queryKey: ['groups'] });
            void queryClient.invalidateQueries({ queryKey: ['trip-info'] });
            void queryClient.invalidateQueries({
                queryKey: groupQueryKeys.details(updated.groupId),
            });
            void queryClient.invalidateQueries({ queryKey: ['splits'] });
            void queryClient.invalidateQueries({ queryKey: ['analytics'] });
            void queryClient.invalidateQueries({ queryKey: ['spendings'] });
        },
    });
}

export function useAddGroupMemberMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: addGroupMemberApi,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: groupQueryKeys.all() });
            void queryClient.invalidateQueries({ queryKey: ['people'] });
        },
    });
}

export function useRemoveGroupMemberMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: removeGroupMemberApi,
        onSuccess: (_data, vars) => {
            void queryClient.invalidateQueries({ queryKey: groupQueryKeys.all() });
            void queryClient.invalidateQueries({ queryKey: groupQueryKeys.details(vars.groupId) });
            void queryClient.invalidateQueries({ queryKey: ['people'] });
            void queryClient.invalidateQueries({ queryKey: ['trip-info'] });
        },
    });
}

export function useLeaveGroupMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: leaveGroupApi,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: groupQueryKeys.all() });
            void queryClient.invalidateQueries({ queryKey: groupQueryKeys.former() });
            void queryClient.invalidateQueries({ queryKey: ['splits'] });
            void queryClient.invalidateQueries({ queryKey: ['spendings'] });
            void queryClient.invalidateQueries({ queryKey: ['people'] });
            void queryClient.invalidateQueries({ queryKey: ['analytics'] });
            void queryClient.invalidateQueries({ queryKey: ['trip-info'] });
        },
    });
}

