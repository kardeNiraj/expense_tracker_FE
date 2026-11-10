import { createContext } from 'react';
import type { DeviceStateResponse } from '../api/types';

export type AppTab = 'dashboard' | 'splits' | 'add' | 'analytics' | 'people' | 'admin';

export interface ClaimActionResult {
    ok: boolean;
    code?: string;
    message?: string;
}

export interface ExpenseContextType {
    activePerson: string;
    setActivePerson: (name: string) => void;
    claimedPerson: string | null;
    isDeviceClaimed: boolean;
    currentDeviceId: string;
    deviceState: DeviceStateResponse | null;
    personLocks: Record<string, boolean>;
    blockedPeopleForDevice: string[];
    isDeviceBlocked: boolean;
    accessRestrictionReason: string | null;
    claimProfile: (name: string) => Promise<ClaimActionResult>;
    requestClaimApproval: (name: string) => Promise<ClaimActionResult>;
    unlockProfileSwitch: (passcode: string) => Promise<boolean>;
    unclaimDevice: () => Promise<boolean>;
    refreshDeviceStatus: () => Promise<void>;
    isSwitcherUnlocked: boolean;
    lockSwitcher: () => void;
    activeTab: AppTab;
    setActiveTab: (tab: AppTab) => void;
    toast: { message: string; icon?: string; visible: boolean };
    showToast: (message: string, icon?: string) => void;
}

export const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);
