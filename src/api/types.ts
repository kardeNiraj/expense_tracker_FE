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
}

export interface SpendingsData {
    payee: string;
    today: number;
    currentMonth: number;
    total: number;
    todayExpensesCount: number;
    totalExpensesCount: number;
    recentExpenses: ExpenseRecord[];
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
    amount: number;
    description: string;
    category: string;
    paidBy: string;
    createdBy: string;
    contributions?: Contribution[];
    participants: string[];
    recordExpense?: boolean;
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
}

export interface UpdateUpiPayload {
    name: string;
    upiId: string;
}
