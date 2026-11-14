import { createContext } from 'react';
import type {
    AuthConfigResponse,
    AuthResponse,
    AuthUser,
    DeviceStateResponse,
    GroupSummary,
} from '../api/types';

export type AppTab =
    | 'dashboard'
    | 'splits'
    | 'add'
    | 'analytics'
    | 'people'
    | 'groups'
    | 'admin'
    | 'privacy'
    | 'terms';

export interface ClaimActionResult {
    ok: boolean;
    code?: string;
    message?: string;
}

export interface ExpenseContextType {
    // Auth & Multi-Room Context
    user: AuthUser | null;
    isAuthenticated: boolean;
    isAuthLoading: boolean;
    authConfig: AuthConfigResponse | null;
    groups: GroupSummary[];
    formerGroups: GroupSummary[];
    activeGroupId: string | null;
    activeGroup: GroupSummary | null;
    isFormerActiveGroup: boolean;
    isRoomArchived: boolean;
    isRoomClosed: boolean;
    isRoomReadOnly: boolean;
    pendingInviteCode: string | null;
    pendingRecoverToken: string | null;
    setActiveGroupId: (groupId: string | null) => void;
    setPendingInviteCode: (code: string | null) => void;
    clearPendingRecoverToken: () => void;
    completeAuthSession: (res: AuthResponse) => void;
    onJoinedOrCreatedGroup: (group: GroupSummary) => void;
    refreshAuthAndGroups: () => Promise<void>;
    logoutUser: () => void;

    // Member Identity & Device Guard
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

    // Navigation & UI
    activeTab: AppTab;
    setActiveTab: (tab: AppTab) => void;
    focusedSplitId: string | null;
    setFocusedSplitId: (splitId: string | null) => void;
    toast: { message: string; icon?: string; visible: boolean };
    showToast: (message: string, icon?: string) => void;
}

export const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);
