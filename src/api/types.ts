export interface ApiResponse<T> {
    success?: boolean;
    data: T;
    message?: string;
    status?: string;
}

export interface PersonDetail {
    name: string;
    upiId: string | null;
}

export interface Contribution {
    person: string;
    amount: number;
}

export interface Settlement {
    from: string;
    to: string;
    amount: number;
    toUpiId?: string | null;
    upiIntent?: string;
    status: 'PENDING' | 'SETTLED';
}

export interface IndividualNotification {
    person: string;
    message: string;
}

export interface SplitNotifications {
    individualMessages?: IndividualNotification[];
    groupSummary?: string;
}

export interface Split {
    splitId: string;
    groupId?: string | null;
    timestamp?: string;
    description: string;
    category: string;
    totalAmount: number;
    paidBy: string;
    createdBy?: string;
    contributions: Contribution[];
    participants: string[];
    settlements: Settlement[];
    status: 'ACTIVE' | 'SETTLED';
    expenseRef?: string;
    notifications?: SplitNotifications;
    rowIndex?: number;
}

export interface ExpenseRecord {
    timestamp?: string;
    category: string;
    amount: number;
    description: string;
    sheet?: string;
    isSplitRow?: boolean;
}

export interface MonthSpendStats {
    month: string;
    total: number;
    directTotal: number;
    splitRecordedTotal: number;
    expensesCount: number;
    expenses?: ExpenseRecord[];
}

export interface SpendingsData {
    payee: string;
    today: number;
    currentMonth: number;
    total: number;
    directToday?: number;
    directCurrentMonth?: number;
    directTotal?: number;
    splitRecordedTotal?: number;
    directExpensesCount?: number;
    todayExpensesCount: number;
    totalExpensesCount: number;
    recentExpenses: ExpenseRecord[];
    allExpenses?: ExpenseRecord[];
    monthlyStats?: MonthSpendStats[];
}

export interface TripMetaItem {
    title: string;
    id: number;
}

export interface TripInfo {
    groupId?: string | null;
    title: string;
    subtitle?: string;
    icon?: string;
    inviteCode?: string | null;
    roomCode?: string | null;
    status?: 'ACTIVE' | 'ARCHIVED' | 'CLOSED';
    archivedAt?: string | null;
    closedAt?: string | null;
    isReadOnly?: boolean;
    membershipStatus?: 'ACTIVE' | 'FORMER';
}

// Mutation Payloads
export interface AddExpensePayload {
    expenseId?: string;
    groupId?: string | null;
    payee: string;
    category: string;
    amount: number;
    description: string;
    timestamp?: string;
}

export interface AddSplitPayload {
    splitId?: string;
    groupId?: string | null;
    amount: number;
    description: string;
    category: string;
    paidBy: string;
    createdBy: string;
    timestamp?: string;
    contributions?: Contribution[];
    participants: string[];
    recordExpense?: boolean;
    splitMode?: 'EQUAL' | 'CUSTOM';
    customShares?: { person: string; share: number }[];
}

export interface AddContributionPayload {
    splitId: string;
    groupId?: string | null;
    person: string;
    amount: number;
}

export interface SettleParticipantPayload {
    splitId: string;
    groupId?: string | null;
    from: string;
    to?: string;
    settled?: boolean;
    confirmedBy?: string;
}

export interface UpdateUpiPayload {
    name: string;
    upiId: string;
    groupId?: string | null;
    requestedBy?: string;
}

export interface UpdateSplitPayload {
    splitId: string;
    groupId?: string | null;
    amount?: number;
    description?: string;
    category?: string;
    participants?: string[];
    splitMode?: 'EQUAL' | 'CUSTOM';
    customShares?: { person: string; share: number }[];
    requestedBy?: string;
}

// Analytics Response Types
export type AnalyticsRange = 'all' | 'this_month' | 'last_month' | '30d' | '7d';

export interface AnalyticsScope {
    groupId?: string | null;
    person: string;
    isGroupView: boolean;
    month: string;
    range: string;
    generatedAt: string;
    availableMonths: string[];
    availablePeople: string[];
}

export interface AnalyticsLargestExpense {
    description: string;
    category: string;
    amount: number;
    timestamp: string | null;
    isSplit: boolean;
    paidBy: string;
}

export interface AnalyticsSummary {
    trueSpend: number;
    outOfPocketPaid: number;
    directSpend: number;
    splitShareSpend: number;
    directCount: number;
    splitCount: number;
    totalTransactions: number;
    avgTransaction: number;
    avgDailySpend: number;
    activeDaysCount: number;
    todaySpend: number;
    currentMonthSpend: number;
    previousMonthSpend: number;
    monthOverMonthDeltaPct: number | null;
    projectedMonthEndSpend: number;
    largestExpense: AnalyticsLargestExpense | null;
}

export interface AnalyticsCounterparty {
    person: string;
    toReceive: number;
    toPay: number;
    netAmount: number;
    pendingCount: number;
}

export interface AnalyticsSettlementsOverview {
    toReceive: number;
    toPay: number;
    netBalance: number;
    settledCount: number;
    pendingCount: number;
    settlementRatePct: number;
    offsetPairsCount?: number;
    offsetSplitsCount?: number;
    counterparties: AnalyticsCounterparty[];
}

export interface AnalyticsCategoryStat {
    category: string;
    amount: number;
    directAmount: number;
    splitAmount: number;
    upfrontAmount: number;
    percentage: number;
    count: number;
    avgAmount: number;
}

export interface AnalyticsDailyPoint {
    date: string;
    label: string;
    amount: number;
    directAmount: number;
    splitAmount: number;
    cumulativeAmount: number;
    count: number;
}

export interface AnalyticsMonthlyPoint {
    month: string;
    total: number;
    directAmount: number;
    splitAmount: number;
    upfrontPaid: number;
    count: number;
    topCategory: string | null;
    categories: Record<string, number>;
}

export interface AnalyticsDayOfWeekPoint {
    day: string;
    dayIndex: number;
    isWeekend: boolean;
    amount: number;
    count: number;
    avgAmount: number;
}

export interface AnalyticsMemberStat {
    person: string;
    trueSpend: number;
    outOfPocketPaid: number;
    directSpend: number;
    splitShareSpend: number;
    netPendingBalance: number;
    shareOfGroupPct: number;
}

export interface AnalyticsInsight {
    id: string;
    type: string;
    tone: 'info' | 'positive' | 'warning';
    title: string;
    message: string;
}

export interface AnalyticsTransaction {
    id: string;
    description: string;
    category: string;
    amount: number;
    upfrontAmount: number;
    timestamp: string | null;
    date: string | null;
    month: string;
    isSplit: boolean;
    paidBy: string;
    splitId: string | null;
    totalBill: number;
    participantsCount: number;
}

export interface AnalyticsData {
    scope: AnalyticsScope;
    summary: AnalyticsSummary;
    settlementsOverview: AnalyticsSettlementsOverview;
    byCategory: AnalyticsCategoryStat[];
    dailyTrend: AnalyticsDailyPoint[];
    monthlyTrend: AnalyticsMonthlyPoint[];
    dayOfWeek: AnalyticsDayOfWeekPoint[];
    memberBreakdown: AnalyticsMemberStat[];
    insights: AnalyticsInsight[];
    transactions: AnalyticsTransaction[];
}

// Device Registry & Strict Admin Types
export type DeviceStatus = 'ACTIVE' | 'IDLE' | 'DORMANT' | 'BLOCKED';

export interface DeviceAuditEvent {
    id?: string;
    action: string;
    person: string | null;
    at: string;
    by: string;
}

export interface DeviceStateResponse {
    deviceId: string;
    exists: boolean;
    status: DeviceStatus;
    claimedPerson: string | null;
    approvedPeople: string[];
    blockedPeople: string[];
    pendingPerson: string | null;
    label: string;
    platform: string;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    claimCount: number;
    personLocks: Record<string, boolean>;
    claimSyncConflict?: string | null;
    blockedForActivePerson?: boolean;
}

export interface AdminLoginResponse {
    token: string;
    expiresAt: number;
    role: string;
    deviceId: string | null;
}

export interface AdminPersonDeviceSummary {
    deviceId: string;
    label: string;
    platform: string;
    status: DeviceStatus;
    lastSeenAt: string | null;
    firstSeenAt: string | null;
}

export interface AdminPersonStat {
    person: string;
    claimedCount: number;
    activeDeviceCount: number;
    blockedForPersonCount: number;
    approvedDeviceCount: number;
    pendingCount: number;
    isLocked: boolean;
    isMultiDevice: boolean;
    devices: AdminPersonDeviceSummary[];
    trueSpend: number;
    netPendingBalance: number;
}

export interface AdminDeviceRecord {
    deviceId: string;
    claimedPerson: string | null;
    approvedPeople: string[];
    blockedPeople: string[];
    status: DeviceStatus;
    label: string;
    platform: string;
    userAgent?: string;
    pendingPerson: string | null;
    pendingGroupId?: string | null;
    pendingGroupName?: string | null;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    claimCount: number;
    auditHistory?: DeviceAuditEvent[];
}

export interface AdminRoomSummary {
    groupId: string;
    name: string;
    subtitle?: string;
    icon?: string;
    status: 'ACTIVE' | 'ARCHIVED' | 'CLOSED';
    createdByName: string;
    createdByUserId?: string | null;
    memberCount: number;
    claimedMemberCount: number;
    unclaimedMemberCount: number;
    totalSpend: number;
    activeSplitsCount: number;
    pendingSettlementsAmount: number;
    createdAt: string;
}

export interface AdminDashboardSummary {
    totalDevices: number;
    activeDevices: number;
    idleDevices?: number;
    dormantDevices?: number;
    blockedDevices: number;
    claimedDevices: number;
    unclaimedDevices: number;
    pendingApprovalsCount: number;
    lockedPeopleCount: number;
    multiDevicePeopleCount: number;
    totalPeople: number;
    totalRooms?: number;
    activeRooms?: number;
    archivedRooms?: number;
    closedRooms?: number;
    totalUsers?: number;
    totalPlatformSpend?: number;
    totalInFlightDebt?: number;
    scope?: {
        isGlobal: boolean;
        groupId: string | null;
        groupName?: string;
        roomStatus?: string | null;
        ownerName?: string | null;
        memberCount?: number;
        claimedMemberCount?: number | null;
    };
}

export interface AdminRecentEvent extends DeviceAuditEvent {
    deviceId: string;
    label?: string;
    platform?: string;
}

export interface AdminDashboardData {
    generatedAt: string;
    summary: AdminDashboardSummary;
    rooms?: AdminRoomSummary[];
    personLocks: Record<string, boolean>;
    personDeviceStats: AdminPersonStat[];
    pendingApprovals: AdminDeviceRecord[];
    devices: AdminDeviceRecord[];
    recentEvents: AdminRecentEvent[];
}

export interface AdminUpdateDevicePayload {
    status?: DeviceStatus;
    label?: string;
    claimedPerson?: string | null;
    approvedPeople?: string[];
    blockedPeople?: string[];
    blockPerson?: string;
    unblockPerson?: string;
    approvePending?: boolean;
    rejectPending?: boolean;
    revokeClaim?: boolean;
}

// Web Push Notifications Types (Standard VAPID / Web Push API)
export interface PushPublicConfig {
    enabled: boolean;
    configured: boolean;
    publicKey: string;
    cooldownSeconds: number;
}

export interface PushDeviceStatusResponse extends PushPublicConfig {
    subscribed: boolean;
    subscribedDevicesCount: number;
    isAdminSubscribed: boolean;
}

export interface WebPushSubscriptionPayload {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
        p256dh: string;
        auth: string;
    };
}

export interface PushSubscribeResponse {
    subscriptionId: string;
    deviceId: string | null;
    person: string | null;
    isAdmin: boolean;
    status: 'ACTIVE' | 'DISABLED' | 'GONE';
    configured: boolean;
}

export interface RemindParticipantPayload {
    splitId: string;
    from: string;
    to?: string;
    requestedBy?: string;
    consolidatedAmount?: number;
    consolidatedCount?: number;
}

export interface RemindParticipantResponse {
    configured: boolean;
    targetPerson: string;
    subscribedDevices: number;
    delivered: number;
    failed: number;
    pruned?: number;
    amount: number;
    message: string;
}

export interface TestPushResponse {
    configured: boolean;
    targeted: number;
    delivered: number;
    pruned: number;
    failed: number;
    message: string;
}

// Auth & Multi-Room / Group Types
export type AuthProvider = 'email' | 'google' | 'pin';

export interface AuthUser {
    userId: string;
    name: string;
    email: string | null;
    authProvider: AuthProvider;
    avatarUrl?: string | null;
    upiId?: string | null;
    defaultGroupId?: string | null;
    createdAt?: string;
}

export interface GroupMember {
    memberId: string;
    name: string;
    userId: string | null;
    role: 'OWNER' | 'MEMBER';
    upiId?: string | null;
    joinedAt?: string | null;
    isClaimed: boolean;
}

export interface GroupSummary {
    groupId: string;
    name: string;
    subtitle: string;
    icon: string;
    inviteCode: string | null;
    roomCode?: string | null;
    createdByUserId: string;
    createdByName: string;
    status: 'ACTIVE' | 'ARCHIVED' | 'CLOSED';
    memberCount: number;
    myRole: 'OWNER' | 'MEMBER' | null;
    myMemberName: string | null;
    isOwner: boolean;
    members: GroupMember[];
    membershipStatus?: 'ACTIVE' | 'FORMER';
    isReadOnly?: boolean;
    archivedAt?: string | null;
    closedAt?: string | null;
    leftAt?: string | null;
    leftEpoch?: number | null;
    leftReason?: 'REMOVED' | 'LEFT' | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface UpdateGroupStatusPayload {
    groupId: string;
    status: 'ACTIVE' | 'ARCHIVED' | 'CLOSED' | 'active' | 'archived' | 'closed';
}

export interface GroupInvitePreview {
    groupId: string;
    name: string;
    subtitle: string;
    icon: string;
    inviteCode: string;
    roomCode?: string | null;
    inviteLabel?: string;
    expiresAt?: string | null;
    createdByName: string;
    memberCount: number;
    unclaimedMembers: {
        memberId: string;
        name: string;
        upiId?: string | null;
    }[];
    members: {
        memberId: string;
        name: string;
        role: 'OWNER' | 'MEMBER';
        isClaimed: boolean;
    }[];
}

export interface GroupInviteToken {
    inviteId: string;
    groupId: string;
    label: string;
    tokenPreview?: string;
    isPrimary: boolean;
    status: 'ACTIVE' | 'REVOKED' | 'EXHAUSTED';
    useCount: number;
    maxUses: number | null;
    expiresAt: string | null;
    createdByUserId: string;
    createdAt: string;
    revokedAt?: string | null;
}

export interface CreateGroupInvitePayload {
    groupId: string;
    label?: string;
    expiresInHours?: number | null;
    maxUses?: number | null;
    setAsPrimary?: boolean;
}

export interface CreateGroupInviteResponse {
    invite: GroupInviteToken;
    token: string;
    isPrimary: boolean;
}

export interface RevokeGroupInviteResponse {
    revoked: boolean;
    invite: GroupInviteToken;
    group: GroupSummary;
}

export interface AuthConfigResponse {
    googleEnabled: boolean;
    googleClientId: string | null;
    methods: AuthProvider[];
    emailRecoveryEnabled?: boolean;
    emailDeliveryConfigured?: boolean;
}

export interface AuthResponse {
    token: string;
    expiresAt: number;
    user: AuthUser;
    groups: GroupSummary[];
    formerGroups?: GroupSummary[];
    isNewUser?: boolean;
}

export interface AuthMeResponse {
    user: AuthUser;
    groups: GroupSummary[];
    formerGroups?: GroupSummary[];
}

export interface ForgotPasswordPayload {
    email: string;
}

export interface ForgotPasswordResponse {
    sent: boolean;
    expiresInMinutes: number;
    deliveryMode: string;
    message: string;
    devRecoveryCode?: string;
    devResetToken?: string;
}

export interface ResetPasswordPayload {
    email?: string;
    code?: string;
    token?: string;
    newPassword: string;
}

export interface RegisterEmailPayload {
    name: string;
    email: string;
    password: string;
    upiId?: string;
}

export interface LoginEmailPayload {
    email: string;
    password: string;
}

export interface GoogleAuthPayload {
    credential: string;
}

export interface PinAuthPayload {
    name: string;
    pin: string;
    upiId?: string;
}

export interface UpdateMePayload {
    name?: string;
    upiId?: string | null;
    defaultGroupId?: string | null;
}

export interface CreateGroupPayload {
    name: string;
    subtitle?: string;
    icon?: string;
    initialMembers?: string[];
}

export interface JoinGroupPayload {
    inviteCode: string;
    linkMemberName?: string;
    displayName?: string;
    upiId?: string;
}

export interface JoinGroupResponse {
    group: GroupSummary;
    alreadyMember: boolean;
    joinedAs: string;
}

export interface UpdateGroupPayload {
    groupId: string;
    name?: string;
    subtitle?: string;
    icon?: string;
    regenerateInvite?: boolean;
    regenerateInviteCode?: boolean;
}

export interface AddGroupMemberPayload {
    groupId: string;
    name: string;
    upiId?: string;
}



