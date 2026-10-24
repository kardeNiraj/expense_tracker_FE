import React, { useState, useMemo, useCallback } from 'react';
import type { AppTab } from './ExpenseContextDef';
import { ExpenseContext } from './ExpenseContextDef';
import { ENV } from '../config';

export const ExpenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activePerson, setActivePersonState] = useState<string>(() => {
        try {
            const saved = localStorage.getItem('active_person') || localStorage.getItem('manali_active_person');
            if (saved) return saved;
        } catch {
            // fallback
        }
        return ENV.DEFAULT_ACTIVE_PERSON;
    });

    const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
    const [toast, setToast] = useState<{ message: string; icon?: string; visible: boolean }>({
        message: '',
        visible: false,
    });

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
            activeTab,
            setActiveTab,
            toast,
            showToast,
        }),
        [activePerson, setActivePerson, activeTab, toast, showToast]
    );

    return (
        <ExpenseContext.Provider value={contextValue}>
            {children}
        </ExpenseContext.Provider>
    );
};

export default ExpenseProvider;
