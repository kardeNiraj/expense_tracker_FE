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

export interface SettlementAppLinks {
    standard?: string;
    phonepe?: string;
    gpay?: string;
    paytm?: string;
}

export interface Settlement {
    from: string;
    to: string;
    amount: number;
    toUpiId?: string | null;
    upiIntent?: string;
    appLinks?: SettlementAppLinks;
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
    expenses: ExpenseRecord[];
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
    title: string;
    subtitle?: string;
    icon?: string;
}

// Mutation Payloads
export interface AddExpensePayload {
    payee: string;
    category: string;
    amount: number;
    description: string;
}

export interface AddSplitPayload {
    splitId?: string;
    amount: number;
    description: string;
    category: string;
    paidBy: string;
    createdBy: string;
    contributions?: Contribution[];
    participants: string[];
    recordExpense?: boolean;
    splitMode?: 'EQUAL' | 'CUSTOM';
    customShares?: { person: string; share: number }[];
}

export interface AddContributionPayload {
    splitId: string;
    person: string;
    amount: number;
}

export interface SettleParticipantPayload {
    splitId: string;
    from: string;
    to?: string;
    settled?: boolean;
    confirmedBy?: string;
}

export interface UpdateUpiPayload {
    name: string;
    upiId: string;
    requestedBy?: string;
}

export interface UpdateSplitPayload {
    splitId: string;
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

