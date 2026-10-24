import { createContext } from 'react';

export type AppTab = 'dashboard' | 'splits' | 'add' | 'people';

export interface ExpenseContextType {
    activePerson: string;
    setActivePerson: (name: string) => void;
    activeTab: AppTab;
    setActiveTab: (tab: AppTab) => void;
    toast: { message: string; icon?: string; visible: boolean };
    showToast: (message: string, icon?: string) => void;
}

export const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);
