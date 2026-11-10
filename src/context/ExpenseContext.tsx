import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { AppTab } from './ExpenseContextDef';
import { ExpenseContext } from './ExpenseContextDef';
import { ENV } from '../config';
import { loginAdminApi } from '../api/deviceApi';
import {
    clearActiveAdminToken,
    getActiveAdminToken,
    setActiveAdminToken,
} from '../utils/deviceIdentity';
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
    const [claimedPerson, setClaimedPersonState] = useState<string | null>(readInitialClaimedPerson);
    const [isSwitcherUnlocked, setIsSwitcherUnlockedState] = useState<boolean>(() =>
        Boolean(getActiveAdminToken())
    );
    const [activePerson, setActivePersonState] = useState<string>(readInitialActivePerson);
    const [activeTab, setActiveTabState] = useState<AppTab>(() =>
        typeof window !== 'undefined' ? getTabFromPathname(window.location.pathname) : 'dashboard'
    );
    const [toast, setToast] = useState<{ message: string; icon?: string; visible: boolean }>({
        message: '',
        visible: false,
    });

    const claimedPersonRef = useRef<string | null>(claimedPerson);
    const activePersonRef = useRef<string>(activePerson);
    const activeTabRef = useRef<AppTab>(activeTab);

    useEffect(() => {
        claimedPersonRef.current = claimedPerson;
    }, [claimedPerson]);

    useEffect(() => {
        activePersonRef.current = activePerson;
    }, [activePerson]);

    useEffect(() => {
        activeTabRef.current = activeTab;
    }, [activeTab]);

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

    const unlockProfileSwitch = useCallback(
        async (passcode: string): Promise<boolean> => {
            if (!passcode.trim()) return false;
            try {
                const res = await loginAdminApi(passcode);
                if (res?.token) {
                    setActiveAdminToken(res.token, res.expiresAt);
                    setIsSwitcherUnlockedState(true);
                    void refreshDeviceStatus();
                    return true;
                }
                return false;
            } catch {
                return false;
            }
        },
        [refreshDeviceStatus]
    );

    const setActivePerson = useCallback((name: string) => {
        activePersonRef.current = name;
        setActivePersonState(name);
        persistActivePerson(name);
    }, []);

    const isDeviceClaimed = Boolean(claimedPerson);
    const personLocks = useMemo(() => deviceState?.personLocks || {}, [deviceState]);
    const blockedPeopleForDevice = useMemo(() => deviceState?.blockedPeople || [], [deviceState]);

    const contextValue = useMemo(
        () => ({
            activePerson,
            setActivePerson,
            claimedPerson,
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
            toast,
            showToast,
        }),
        [
            activePerson,
            setActivePerson,
            claimedPerson,
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
            toast,
            showToast,
        ]
    );

    return <ExpenseContext.Provider value={contextValue}>{children}</ExpenseContext.Provider>;
};

export default ExpenseProvider;
