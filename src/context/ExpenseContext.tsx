import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AppTab } from './ExpenseContextDef';
import { ExpenseContext } from './ExpenseContextDef';
import { ENV } from '../config';
import { queryKeys } from '../api';
import { ApiError } from '../api/client';
import {
    authQueryKeys,
    useAuthConfig,
    useAuthMe,
} from '../api/authApi';
import { groupQueryKeys, useFormerGroups, useGroups } from '../api/groupApi';
import { loginAdminApi } from '../api/deviceApi';
import type { AuthResponse, AuthUser, GroupSummary } from '../api/types';
import {
    clearAllUserAuthStorage,
    extractStartupUrlParams,
    getActiveGroupId,
    getPendingInviteCode,
    getPendingRecoverToken,
    getStoredUserGroups,
    getStoredUserProfile,
    getUserToken,
    setActiveGroupIdStorage,
    setPendingInviteCodeStorage,
    setPendingRecoverTokenStorage,
    setStoredUserGroups,
    setStoredUserProfile,
    setUserToken,
    subscribeToUserAuthExpired,
} from '../utils/authStorage';
import {
    clearActiveAdminToken,
    getActiveAdminToken,
    setActiveAdminToken,
} from '../utils/deviceIdentity';
import { resetPushSyncSession, syncExistingPushSubscription } from '../utils/pushNotifications';
import {
    clearPersistedClaim,
    getTabFromPathname,
    persistActivePerson,
    persistClaimedPerson,
    pushTabPath,
    readInitialActivePerson,
    readInitialClaimedPerson,
} from './expenseStorage';
import { useDeviceSync } from './useDeviceSync';

export const ExpenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const queryClient = useQueryClient();

    const [startupParams] = useState(() => extractStartupUrlParams());
    const [hasUserSession, setHasUserSession] = useState<boolean>(() => Boolean(getUserToken()));
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
        () => startupParams.groupId || getActiveGroupId()
    );
    const [pendingInviteCode, setPendingInviteCodeState] = useState<string | null>(
        () => startupParams.inviteCode || getPendingInviteCode()
    );
    const [pendingRecoverToken, setPendingRecoverTokenState] = useState<string | null>(
        () => startupParams.recoverToken || getPendingRecoverToken()
    );

    const [claimedPerson, setClaimedPersonState] = useState<string | null>(readInitialClaimedPerson);
    const [isSwitcherUnlocked, setIsSwitcherUnlockedState] = useState<boolean>(() =>
        Boolean(getActiveAdminToken())
    );
    const [activePerson, setActivePersonState] = useState<string>(readInitialActivePerson);
    const [activeTab, setActiveTabState] = useState<AppTab>(() =>
        typeof window !== 'undefined' ? getTabFromPathname(window.location.pathname) : 'dashboard'
    );
    const [focusedSplitId, setFocusedSplitIdState] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;
        return new URLSearchParams(window.location.search).get('splitId')?.trim() || null;
    });
    const [toast, setToast] = useState<{ message: string; icon?: string; visible: boolean }>({
        message: '',
        visible: false,
    });

    const authConfigQuery = useAuthConfig(true);
    const authMeQuery = useAuthMe(hasUserSession);
    const groupsQuery = useGroups(hasUserSession);
    const formerGroupsQuery = useFormerGroups(hasUserSession);

    const user: AuthUser | null = useMemo(() => {
        if (!hasUserSession) return null;
        if (authMeQuery.isError) {
            const err = authMeQuery.error;
            const isAuthError =
                (err instanceof ApiError &&
                    (err.status === 401 ||
                        err.code === 'USER_NOT_FOUND' ||
                        err.code === 'USER_UNAUTHORIZED' ||
                        err.code === 'TOKEN_EXPIRED')) ||
                (err as { status?: number })?.status === 401;
            if (isAuthError) return null;
        }
        return authMeQuery.data?.user ?? getStoredUserProfile();
    }, [hasUserSession, authMeQuery.data, authMeQuery.isError, authMeQuery.error]);

    const groups: GroupSummary[] = useMemo(() => {
        if (!hasUserSession) return [];
        const liveGroups = groupsQuery.data ?? authMeQuery.data?.groups;
        if (liveGroups) return liveGroups;
        return getStoredUserGroups();
    }, [hasUserSession, groupsQuery.data, authMeQuery.data]);

    const formerGroups: GroupSummary[] = useMemo(() => {
        if (!hasUserSession) return [];
        return formerGroupsQuery.data ?? authMeQuery.data?.formerGroups ?? [];
    }, [hasUserSession, formerGroupsQuery.data, authMeQuery.data?.formerGroups]);

    useEffect(() => {
        if (authMeQuery.data?.user) {
            setStoredUserProfile(authMeQuery.data.user);
        }
    }, [authMeQuery.data?.user]);

    useEffect(() => {
        if (groupsQuery.data) {
            setStoredUserGroups(groupsQuery.data);
        } else if (authMeQuery.data?.groups) {
            setStoredUserGroups(authMeQuery.data.groups);
        }
    }, [groupsQuery.data, authMeQuery.data?.groups]);

    const defaultGroupId = user?.defaultGroupId;
    const activeGroup: GroupSummary | null = useMemo(() => {
        if (!hasUserSession) return null;
        if (selectedGroupId) {
            const matched = groups.find((g) => g.groupId === selectedGroupId);
            if (matched) return matched;
            const formerMatched = formerGroups.find((g) => g.groupId === selectedGroupId);
            if (formerMatched) return formerMatched;
        }
        if (groups.length === 0) return null;
        if (defaultGroupId) {
            const def = groups.find((g) => g.groupId === defaultGroupId);
            if (def) return def;
        }
        return groups[0] || null;
    }, [hasUserSession, groups, formerGroups, selectedGroupId, defaultGroupId]);

    const activeGroupId = activeGroup?.groupId || null;
    const isRoomArchived = activeGroup?.status === 'ARCHIVED';
    const isRoomClosed = activeGroup?.status === 'CLOSED';
    const isFormerActiveGroup = Boolean(
        activeGroup?.membershipStatus === 'FORMER'
    );
    const isRoomReadOnly = Boolean(
        isFormerActiveGroup || isRoomClosed || activeGroup?.isReadOnly
    );

    useEffect(() => {
        if (!hasUserSession) {
            setActiveGroupIdStorage(null);
            return;
        }
        if (groups.length === 0 && formerGroups.length === 0) return;
        if (
            selectedGroupId &&
            !groups.some((g) => g.groupId === selectedGroupId) &&
            !formerGroups.some((g) => g.groupId === selectedGroupId) &&
            !groupsQuery.isFetched
        ) {
            return;
        }
        setActiveGroupIdStorage(activeGroupId);
    }, [
        hasUserSession,
        groups,
        formerGroups,
        selectedGroupId,
        activeGroupId,
        groupsQuery.isFetched,
    ]);

    const isAuthenticated = Boolean(hasUserSession && user);
    const isAuthLoading =
        hasUserSession && !user && (authMeQuery.isLoading || groupsQuery.isLoading);

    const roomMemberName = activeGroup?.myMemberName || user?.name || null;

    const effectiveClaimedPerson =
        isAuthenticated && roomMemberName ? roomMemberName : claimedPerson;

    const effectiveActivePerson = useMemo(() => {
        if (isAuthenticated && activeGroup) {
            if (isSwitcherUnlocked) {
                const isMemberInRoom = activeGroup.members.some(
                    (m) => m.name.toLowerCase() === activePerson.toLowerCase()
                );
                if (isMemberInRoom) return activePerson;
            }
            return roomMemberName || activePerson;
        }
        return activePerson;
    }, [isAuthenticated, activeGroup, isSwitcherUnlocked, activePerson, roomMemberName]);

    const claimedPersonRef = useRef<string | null>(effectiveClaimedPerson);
    const activePersonRef = useRef<string>(effectiveActivePerson);
    const activeTabRef = useRef<AppTab>(activeTab);

    useEffect(() => {
        claimedPersonRef.current = effectiveClaimedPerson;
        activePersonRef.current = effectiveActivePerson;
        activeTabRef.current = activeTab;
    }, [effectiveClaimedPerson, effectiveActivePerson, activeTab]);

    const authUserId = user?.userId || null;
    useEffect(() => {
        if (!isAuthenticated || !authUserId) return;
        void syncExistingPushSubscription({
            person: claimedPersonRef.current,
            force: true,
        }).then((synced) => {
            if (synced) {
                void queryClient.invalidateQueries({ queryKey: queryKeys.pushStatus() });
            }
        });
    }, [isAuthenticated, authUserId, queryClient]);

    useEffect(() => {
        if (isAuthenticated && roomMemberName) {
            persistClaimedPerson(roomMemberName);
        }
    }, [isAuthenticated, roomMemberName, activeGroupId]);

    const showToast = useCallback((message: string, icon: string = 'check_circle') => {
        setToast({ message, icon, visible: true });
        setTimeout(() => {
            setToast((prev) => ({ ...prev, visible: false }));
        }, ENV.TOAST_DURATION_MS);
    }, []);

    const setActiveTab = useCallback((tab: AppTab) => {
        activeTabRef.current = tab;
        setActiveTabState(tab);
        pushTabPath(tab);
    }, []);

    const setFocusedSplitId = useCallback((splitId: string | null) => {
        const clean = splitId ? splitId.trim() : null;
        setFocusedSplitIdState(clean);
        if (typeof window !== 'undefined' && !clean) {
            const url = new URL(window.location.href);
            if (url.searchParams.has('splitId')) {
                url.searchParams.delete('splitId');
                const nextUrl = `${url.pathname}${url.search}${url.hash}`;
                window.history.replaceState(window.history.state, '', nextUrl);
            }
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handlePopState = () => {
            const nextTab = getTabFromPathname(window.location.pathname);
            activeTabRef.current = nextTab;
            setActiveTabState(nextTab);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const clearLocalClaim = useCallback(() => {
        claimedPersonRef.current = null;
        activePersonRef.current = ENV.DEFAULT_ACTIVE_PERSON;
        setClaimedPersonState(null);
        setActivePersonState(ENV.DEFAULT_ACTIVE_PERSON);
        clearPersistedClaim();
    }, []);

    const applyLocalClaim = useCallback((name: string) => {
        claimedPersonRef.current = name;
        activePersonRef.current = name;
        setClaimedPersonState(name);
        setActivePersonState(name);
        persistClaimedPerson(name);
    }, []);

    const clearAdminSession = useCallback(() => {
        clearActiveAdminToken();
        setIsSwitcherUnlockedState(false);
        const owned = claimedPersonRef.current;
        if (owned) {
            activePersonRef.current = owned;
            setActivePersonState(owned);
            persistActivePerson(owned);
        }
    }, []);

    const lockSwitcher = useCallback(() => {
        clearAdminSession();
        if (activeTabRef.current === 'admin') {
            activeTabRef.current = 'dashboard';
            setActiveTabState('dashboard');
            pushTabPath('dashboard');
        }
    }, [clearAdminSession]);

    const {
        currentDeviceId,
        deviceState,
        isDeviceBlocked,
        accessRestrictionReason,
        refreshDeviceStatus,
        claimProfile,
        requestClaimApproval,
        unclaimDevice,
    } = useDeviceSync({
        claimedPersonRef,
        activePersonRef,
        applyLocalClaim,
        clearLocalClaim,
        onAdminSessionInvalid: clearAdminSession,
        showToast,
    });

    const prevGroupIdRef = useRef<string | null>(activeGroupId);
    useEffect(() => {
        if (prevGroupIdRef.current !== activeGroupId) {
            prevGroupIdRef.current = activeGroupId;
            if (activeGroupId) {
                void refreshDeviceStatus();
                void queryClient.invalidateQueries({ queryKey: ['splits'] });
                void queryClient.invalidateQueries({ queryKey: ['spendings'] });
                void queryClient.invalidateQueries({ queryKey: ['people'] });
                void queryClient.invalidateQueries({ queryKey: ['analytics'] });
                void queryClient.invalidateQueries({ queryKey: ['trip-info'] });
                void queryClient.invalidateQueries({ queryKey: ['meta'] });
            }
        }
    }, [activeGroupId, queryClient, refreshDeviceStatus]);

    const setPendingInviteCode = useCallback((code: string | null) => {
        const clean = code ? code.trim() : null;
        setPendingInviteCodeState(clean);
        setPendingInviteCodeStorage(clean);
    }, []);

    const clearPendingRecoverToken = useCallback(() => {
        setPendingRecoverTokenState(null);
        setPendingRecoverTokenStorage(null);
    }, []);

    const setActiveGroupId = useCallback(
        (groupId: string | null) => {
            const clean = groupId ? groupId.trim() : null;
            setSelectedGroupId(clean);
            setActiveGroupIdStorage(clean);
            const targetGroup =
                groups.find((g) => g.groupId === clean) ||
                formerGroups.find((g) => g.groupId === clean);
            const memberName = targetGroup?.myMemberName || user?.name;
            if (memberName) {
                setClaimedPersonState(memberName);
                setActivePersonState(memberName);
                persistClaimedPerson(memberName);
                void claimProfile(memberName);
            }
        },
        [groups, formerGroups, user?.name, claimProfile]
    );

    const completeAuthSession = useCallback(
        (res: AuthResponse) => {
            setUserToken(res.token, res.expiresAt);
            setStoredUserProfile(res.user);
            setStoredUserGroups(res.groups || []);
            setHasUserSession(true);
            clearPendingRecoverToken();

            queryClient.setQueryData(authQueryKeys.me(), {
                user: res.user,
                groups: res.groups || [],
                formerGroups: res.formerGroups || [],
            });
            queryClient.setQueryData(groupQueryKeys.all(), res.groups || []);
            queryClient.setQueryData(groupQueryKeys.former(), res.formerGroups || []);

            const resolvedGroupId =
                (res.user.defaultGroupId &&
                (res.groups || []).some((g) => g.groupId === res.user.defaultGroupId)
                    ? res.user.defaultGroupId
                    : res.groups?.[0]?.groupId) || null;

            let targetMemberName = res.user.name;
            if (resolvedGroupId) {
                setSelectedGroupId(resolvedGroupId);
                setActiveGroupIdStorage(resolvedGroupId);
                const resolvedGroup = (res.groups || []).find((g) => g.groupId === resolvedGroupId);
                targetMemberName = resolvedGroup?.myMemberName || res.user.name;
            }

            setClaimedPersonState(targetMemberName);
            setActivePersonState(targetMemberName);
            persistClaimedPerson(targetMemberName);
            void claimProfile(targetMemberName);

            void queryClient.invalidateQueries({ queryKey: ['splits'] });
            void queryClient.invalidateQueries({ queryKey: ['spendings'] });
            void queryClient.invalidateQueries({ queryKey: ['people'] });
            void queryClient.invalidateQueries({ queryKey: ['trip-info'] });
        },
        [queryClient, clearPendingRecoverToken, claimProfile]
    );

    const onJoinedOrCreatedGroup = useCallback(
        (group: GroupSummary) => {
            void queryClient.cancelQueries({ queryKey: groupQueryKeys.all() });
            const currentGroups = queryClient.getQueryData<GroupSummary[]>(groupQueryKeys.all()) || groups;
            const nextGroups = [
                group,
                ...currentGroups.filter((g) => g.groupId !== group.groupId),
            ];
            setStoredUserGroups(nextGroups);
            queryClient.setQueryData(groupQueryKeys.all(), nextGroups);

            const meCache = queryClient.getQueryData<{
                user: AuthUser;
                groups: GroupSummary[];
                formerGroups?: GroupSummary[];
            }>(authQueryKeys.me());
            if (meCache) {
                queryClient.setQueryData(authQueryKeys.me(), {
                    ...meCache,
                    groups: nextGroups,
                    formerGroups: (meCache.formerGroups || []).filter(
                        (g) => g.groupId !== group.groupId
                    ),
                });
            }

            setPendingInviteCode(null);
            setSelectedGroupId(group.groupId);
            setActiveGroupIdStorage(group.groupId);

            const memberName = group.myMemberName || user?.name;
            if (memberName) {
                setClaimedPersonState(memberName);
                setActivePersonState(memberName);
                persistClaimedPerson(memberName);
                void claimProfile(memberName);
            }

            activeTabRef.current = 'dashboard';
            setActiveTabState('dashboard');
            pushTabPath('dashboard');

            void queryClient.invalidateQueries({ queryKey: groupQueryKeys.all() });
            void queryClient.invalidateQueries({ queryKey: groupQueryKeys.former() });
            void queryClient.invalidateQueries({ queryKey: ['splits'] });
            void queryClient.invalidateQueries({ queryKey: ['spendings'] });
            void queryClient.invalidateQueries({ queryKey: ['people'] });
            void queryClient.invalidateQueries({ queryKey: ['analytics'] });
            void queryClient.invalidateQueries({ queryKey: ['trip-info'] });
        },
        [groups, queryClient, setPendingInviteCode, user?.name, claimProfile]
    );

    const refreshAuthAndGroups = useCallback(async () => {
        if (!getUserToken()) return;
        await Promise.allSettled([
            queryClient.invalidateQueries({ queryKey: authQueryKeys.me() }),
            queryClient.invalidateQueries({ queryKey: groupQueryKeys.all() }),
            queryClient.invalidateQueries({ queryKey: groupQueryKeys.former() }),
        ]);
    }, [queryClient]);

    const logoutUser = useCallback(() => {
        clearAllUserAuthStorage();
        resetPushSyncSession();
        setHasUserSession(false);
        setSelectedGroupId(null);
        setPendingInviteCode(null);
        clearPendingRecoverToken();
        clearLocalClaim();
        void unclaimDevice();
        queryClient.removeQueries({ queryKey: authQueryKeys.me() });
        queryClient.removeQueries({ queryKey: groupQueryKeys.all() });
        queryClient.removeQueries({ queryKey: groupQueryKeys.former() });
        queryClient.invalidateQueries({ queryKey: ['splits'] });
        queryClient.invalidateQueries({ queryKey: ['spendings'] });
        queryClient.invalidateQueries({ queryKey: ['people'] });
        queryClient.invalidateQueries({ queryKey: ['analytics'] });
        queryClient.invalidateQueries({ queryKey: ['trip-info'] });
    }, [clearLocalClaim, clearPendingRecoverToken, queryClient, setPendingInviteCode, unclaimDevice]);

    useEffect(() => {
        return subscribeToUserAuthExpired(() => {
            clearAllUserAuthStorage();
            clearPersistedClaim();
            setHasUserSession(false);
            setSelectedGroupId(null);
            queryClient.removeQueries({ queryKey: authQueryKeys.me() });
            queryClient.removeQueries({ queryKey: groupQueryKeys.all() });
            queryClient.removeQueries({ queryKey: groupQueryKeys.former() });
            showToast('Account not found or session expired. Please register or sign in.', 'login');
        });
    }, [queryClient, showToast]);

    const unlockProfileSwitch = useCallback(
        async (passcode: string): Promise<boolean> => {
            if (!passcode.trim()) return false;
            try {
                const res = await loginAdminApi(passcode);
                if (res?.token) {
                    setActiveAdminToken(res.token, res.expiresAt);
                    setIsSwitcherUnlockedState(true);
                    void refreshDeviceStatus();
                    void syncExistingPushSubscription({
                        person: claimedPersonRef.current,
                        force: true,
                    }).then((synced) => {
                        if (synced) {
                            void queryClient.invalidateQueries({
                                queryKey: queryKeys.pushStatus(),
                            });
                        }
                    });
                    return true;
                }
                return false;
            } catch {
                return false;
            }
        },
        [queryClient, refreshDeviceStatus]
    );

    const setActivePerson = useCallback((name: string) => {
        activePersonRef.current = name;
        setActivePersonState(name);
        persistActivePerson(name);
    }, []);

    const isDeviceClaimed = Boolean(effectiveClaimedPerson);
    const personLocks = useMemo(() => deviceState?.personLocks || {}, [deviceState]);
    const blockedPeopleForDevice = useMemo(() => deviceState?.blockedPeople || [], [deviceState]);

    const contextValue = useMemo(
        () => ({
            user,
            isAuthenticated,
            isAuthLoading,
            authConfig: authConfigQuery.data ?? null,
            groups,
            formerGroups,
            activeGroupId,
            activeGroup,
            isFormerActiveGroup,
            isRoomArchived,
            isRoomClosed,
            isRoomReadOnly,
            pendingInviteCode,
            pendingRecoverToken,
            setActiveGroupId,
            setPendingInviteCode,
            clearPendingRecoverToken,
            completeAuthSession,
            onJoinedOrCreatedGroup,
            refreshAuthAndGroups,
            logoutUser,
            activePerson: effectiveActivePerson,
            setActivePerson,
            claimedPerson: effectiveClaimedPerson,
            isDeviceClaimed,
            currentDeviceId,
            deviceState,
            personLocks,
            blockedPeopleForDevice,
            isDeviceBlocked,
            accessRestrictionReason,
            claimProfile,
            requestClaimApproval,
            unlockProfileSwitch,
            unclaimDevice,
            refreshDeviceStatus,
            isSwitcherUnlocked,
            lockSwitcher,
            activeTab,
            setActiveTab,
            focusedSplitId,
            setFocusedSplitId,
            toast,
            showToast,
        }),
        [
            user,
            isAuthenticated,
            isAuthLoading,
            authConfigQuery.data,
            groups,
            formerGroups,
            activeGroupId,
            activeGroup,
            isFormerActiveGroup,
            isRoomArchived,
            isRoomClosed,
            isRoomReadOnly,
            pendingInviteCode,
            pendingRecoverToken,
            setActiveGroupId,
            setPendingInviteCode,
            clearPendingRecoverToken,
            completeAuthSession,
            onJoinedOrCreatedGroup,
            refreshAuthAndGroups,
            logoutUser,
            effectiveActivePerson,
            setActivePerson,
            effectiveClaimedPerson,
            isDeviceClaimed,
            currentDeviceId,
            deviceState,
            personLocks,
            blockedPeopleForDevice,
            isDeviceBlocked,
            accessRestrictionReason,
            claimProfile,
            requestClaimApproval,
            unlockProfileSwitch,
            unclaimDevice,
            refreshDeviceStatus,
            isSwitcherUnlocked,
            lockSwitcher,
            activeTab,
            setActiveTab,
            focusedSplitId,
            setFocusedSplitId,
            toast,
            showToast,
        ]
    );

    return <ExpenseContext.Provider value={contextValue}>{children}</ExpenseContext.Provider>;
};

export default ExpenseProvider;
