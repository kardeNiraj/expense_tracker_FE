import { createContext } from 'react';

export type AppTab = 'dashboard' | 'splits' | 'add' | 'people';

export interface ExpenseContextType {
    activePerson: string;
    setActivePerson: (name: string) => void;
    claimedPerson: string | null;
    isDeviceClaimed: boolean;
    claimProfile: (name: string) => void;
    unlockProfileSwitch: (passcode: string) => boolean;
    unclaimDevice: (passcode: string) => boolean;
    isSwitcherUnlocked: boolean;
    lockSwitcher: () => void;
    activeTab: AppTab;
    setActiveTab: (tab: AppTab) => void;
    toast: { message: string; icon?: string; visible: boolean };
    showToast: (message: string, icon?: string) => void;
}

export const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);
