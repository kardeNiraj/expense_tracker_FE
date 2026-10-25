import React, { useState, useMemo, useCallback } from 'react';
import type { AppTab } from './ExpenseContextDef';
import { ExpenseContext } from './ExpenseContextDef';
import { ENV } from '../config';

export const ExpenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // 1. Claimed Person (locks this device to a user)
    const [claimedPerson, setClaimedPersonState] = useState<string | null>(() => {
        try {
            return localStorage.getItem('claimed_person');
        } catch {
            return null;
        }
    });

    // 2. Active Person (defaults to claimedPerson if set, else saved or ENV default)
    const [activePerson, setActivePersonState] = useState<string>(() => {
        try {
            const claimed = localStorage.getItem('claimed_person');
            if (claimed) return claimed;
            const saved = localStorage.getItem('active_person') || localStorage.getItem('manali_active_person');
            if (saved) return saved;
        } catch {
            // fallback
        }
        return ENV.DEFAULT_ACTIVE_PERSON;
    });

    const [isSwitcherUnlocked, setIsSwitcherUnlocked] = useState(false);
    const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
    const [toast, setToast] = useState<{ message: string; icon?: string; visible: boolean }>({
        message: '',
        visible: false,
    });

    const isDeviceClaimed = Boolean(claimedPerson);

    const claimProfile = useCallback((name: string) => {
        setClaimedPersonState(name);
        setActivePersonState(name);
        setIsSwitcherUnlocked(false);
        try {
            localStorage.setItem('claimed_person', name);
            localStorage.setItem('active_person', name);
        } catch {
            // ignore
        }
    }, []);

    const unlockProfileSwitch = useCallback((passcode: string): boolean => {
        if (passcode.trim() === ENV.ADMIN_PASSCODE) {
            setIsSwitcherUnlocked(true);
            return true;
        }
        return false;
    }, []);

    const unclaimDevice = useCallback((passcode: string): boolean => {
        if (passcode.trim() === ENV.ADMIN_PASSCODE) {
            setClaimedPersonState(null);
            setIsSwitcherUnlocked(false);
            try {
                localStorage.removeItem('claimed_person');
            } catch {
                // ignore
            }
            return true;
        }
        return false;
    }, []);

    const lockSwitcher = useCallback(() => {
        setIsSwitcherUnlocked(false);
    }, []);

    const setActivePerson = useCallback((name: string) => {
        setActivePersonState(name);
        try {
            localStorage.setItem('active_person', name);
            localStorage.setItem('manali_active_person', name);
        } catch {
            // ignore
        }
    }, []);

    const showToast = useCallback((message: string, icon: string = 'check_circle') => {
        setToast({ message, icon, visible: true });
        setTimeout(() => {
            setToast((prev) => ({ ...prev, visible: false }));
        }, ENV.TOAST_DURATION_MS);
    }, []);

    const contextValue = useMemo(
        () => ({
            activePerson,
            setActivePerson,
            claimedPerson,
            isDeviceClaimed,
            claimProfile,
            unlockProfileSwitch,
            unclaimDevice,
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
            claimProfile,
            unlockProfileSwitch,
            unclaimDevice,
            isSwitcherUnlocked,
            lockSwitcher,
            activeTab,
            toast,
            showToast,
        ]
    );

    return (
        <ExpenseContext.Provider value={contextValue}>
            {children}
        </ExpenseContext.Provider>
    );
};

export default ExpenseProvider;
