import React, { useState } from 'react';
import { useExpense } from '../../context';
import {
    apiFetch,
    useCategories,
    usePeople,
    useAddExpenseMutation,
    useAddSplitMutation,
} from '../../api';
import { AppIcon, Avatar } from '../../components';
import { triggerHaptic } from '../../utils/haptics';
import { DEFAULT_CATEGORIES } from '../../config';

const QUICK_INCREMENTS = [50, 100, 200, 500];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
    'Food & Dining': [
        'street food',
        'food & dining',
        'restaurant',
        'restaurants',
        'dining',
        'dhaba',
        'dhabas',
        'cafe',
        'cafes',
        'breakfast',
        'brunch',
        'lunch',
        'dinner',
        'supper',
        'meal',
        'meals',
        'momos',
        'momo',
        'maggi',
        'paratha',
        'parathas',
        'biryani',
        'thali',
        'roti',
        'naan',
        'paneer',
        'dosa',
        'idli',
        'poha',
        'chole',
        'pav bhaji',
        'vada pav',
        'chaat',
        'samosa',
        'pizza',
        'burger',
        'pasta',
        'sandwich',
        'shawarma',
        'noodles',
        'fried rice',
        'curry',
        'buffet',
        'bakery',
        'canteen',
        'tiffin',
        'food',
    ],
    'Beverages & Snacks': [
        'water bottle',
        'water bottles',
        'soft drink',
        'soft drinks',
        'cold drink',
        'cold drinks',
        'energy drink',
        'beverages & snacks',
        'beverage',
        'beverages',
        'refreshment',
        'refreshments',
        'drinks',
        'drink',
        'water',
        'bottle',
        'bottles',
        'tea',
        'chai',
        'coffee',
        'latte',
        'cappuccino',
        'espresso',
        'juice',
        'soda',
        'coke',
        'pepsi',
        'sprite',
        'lassi',
        'milkshake',
        'smoothie',
        'chips',
        'biscuit',
        'biscuits',
        'cookies',
        'namkeen',
        'snack',
        'snacks',
        'beer',
        'wine',
        'alcohol',
        'cocktail',
        'whiskey',
        'vodka',
        'rum',
        'bar',
    ],
    Accommodation: [
        'early check-in',
        'early checkin',
        'room upgrade',
        'room upgrades',
        'guest house',
        'night stay',
        'accommodation',
        'lodging',
        'homestay',
        'homestays',
        'check-in',
        'checkin',
        'checkout',
        'hotel',
        'hotels',
        'hostel',
        'hostels',
        'resort',
        'resorts',
        'airbnb',
        'zostel',
        'oyo',
        'lodge',
        'guesthouse',
        'cottage',
        'villa',
        'camp',
        'camping',
        'tent',
        'dorm',
        'dormitory',
        'room',
        'stay',
    ],
    Transportation: [
        'bus ticket',
        'bus tickets',
        'train ticket',
        'train tickets',
        'flight ticket',
        'flight tickets',
        'local cab',
        'local cabs',
        'bike rental',
        'bike rentals',
        'scooter rental',
        'scooty rental',
        'car rental',
        'e-rickshaw',
        'transportation',
        'transport',
        'commute',
        'bus',
        'taxi',
        'taxis',
        'cab',
        'cabs',
        'uber',
        'ola',
        'rapido',
        'auto',
        'rickshaw',
        'rental',
        'rentals',
        'parking',
        'toll',
        'tolls',
        'fastag',
        'flight',
        'train',
        'metro',
        'ferry',
        'shuttle',
        'fare',
        'transfer',
        'pickup',
        'drop',
        'volvo',
        'travel',
    ],
    Fuel: [
        'ev charging',
        'charging station',
        'petrol pump',
        'fuel pump',
        'full tank',
        'tank full',
        'fuel',
        'petrol',
        'diesel',
        'cng',
        'gasoline',
        'refuel',
        'ev',
    ],
    'Activities & Adventure': [
        'sightseeing entry fee',
        'sightseeing entry fees',
        'activities & adventure',
        'snow activities',
        'snow activity',
        'river rafting',
        'entry fee',
        'entry fees',
        'cable car',
        'zip line',
        'park entry',
        'horse riding',
        'yak ride',
        'paragliding',
        'sightseeing',
        'adventure',
        'activities',
        'activity',
        'tourism',
        'skiing',
        'ski',
        'rafting',
        'ropeway',
        'gondola',
        'snow',
        'trek',
        'trekking',
        'safari',
        'boating',
        'kayaking',
        'zipline',
        'bungee',
        'scuba',
        'snorkeling',
        'museum',
        'monument',
        'fort',
        'ticket',
    ],
    Shopping: [
        'local product',
        'local products',
        'handicraft',
        'handicrafts',
        'souvenir',
        'souvenirs',
        'shopping',
        'clothes',
        'clothing',
        'gifts',
        'gift',
        'jacket',
        'sweater',
        'hoodie',
        'shawl',
        'gloves',
        'shoes',
        't-shirt',
        'tshirt',
        'jeans',
        'merchandise',
        'emporium',
        'bazaar',
        'market',
        'mall',
        'keychain',
        'keepsake',
        'backpack',
    ],
    'Groceries & Supplies': [
        'groceries & supplies',
        'disposable items',
        'disposable item',
        'snacks in bulk',
        'packaged food',
        'bulk snacks',
        'paper plates',
        'paper cups',
        'wet wipes',
        'first aid',
        'groceries',
        'grocery',
        'supplies',
        'toiletries',
        'toiletry',
        'tissue',
        'tissues',
        'medicines',
        'medicine',
        'disposable',
        'disposables',
        'napkin',
        'napkins',
        'wipes',
        'sanitizer',
        'sunscreen',
        'soap',
        'shampoo',
        'toothpaste',
        'toothbrush',
        'pharmacy',
        'chemist',
        'supermarket',
        'kirana',
        'mart',
        'bulk',
        'milk',
        'bread',
        'eggs',
        'fruits',
    ],
    Entertainment: [
        'recreational events',
        'recreational event',
        'movie ticket',
        'movie tickets',
        'club entry',
        'entertainment',
        'recreational',
        'recreation',
        'nightclub',
        'movie',
        'movies',
        'cinema',
        'theatre',
        'theater',
        'pvr',
        'inox',
        'club',
        'disco',
        'dj',
        'party',
        'games',
        'game',
        'gaming',
        'bowling',
        'arcade',
        'billiards',
        'snooker',
        'concert',
        'comedy',
        'standup',
        'karaoke',
        'event',
        'events',
        'music',
        'show',
    ],
    Personal: [
        'personal medicines',
        'personal medicine',
        'individual purchases',
        'individual purchase',
        'personal services',
        'personal service',
        'dry cleaning',
        'dry clean',
        'sim card',
        'personal',
        'individual',
        'laundry',
        'ironing',
        'haircut',
        'salon',
        'barber',
        'spa',
        'massage',
        'grooming',
        'tailor',
        'recharge',
    ],
    Miscellaneous: [
        'unclassified small fees',
        'unclassified small fee',
        'unexpected charges',
        'unexpected charge',
        'incidental expenses',
        'incidental expense',
        'convenience fee',
        'processing fee',
        'service charge',
        'miscellaneous',
        'unclassified',
        'incidental',
        'incidentals',
        'unexpected',
        'small fees',
        'small fee',
        'late fee',
        'bank fee',
        'atm fee',
        'penalty',
        'porter',
        'coolie',
        'charge',
        'charges',
        'misc',
        'fees',
        'fee',
        'tip',
        'tips',
        'fine',
        'atm',
    ],
};

const CATEGORY_PRIORITY_ORDER = [
    'Personal',
    'Fuel',
    'Groceries & Supplies',
    'Beverages & Snacks',
    'Food & Dining',
    'Accommodation',
    'Transportation',
    'Entertainment',
    'Activities & Adventure',
    'Shopping',
    'Miscellaneous',
];

const CATEGORY_LEGACY_ALIASES: Record<string, string[]> = {
    'Food & Dining': ['food', 'dining'],
    'Beverages & Snacks': ['drinks', 'beverages', 'snacks', 'food'],
    Accommodation: ['stay', 'hotel'],
    Transportation: ['travel', 'transport'],
    Fuel: ['fuel', 'travel'],
    'Activities & Adventure': ['activities', 'activity', 'adventure'],
    Shopping: ['shopping'],
    'Groceries & Supplies': ['groceries', 'supplies', 'shopping'],
    Entertainment: ['entertainment', 'activities'],
    Personal: ['personal', 'misc'],
    Miscellaneous: ['misc', 'miscellaneous', 'general', 'other'],
};

function matchesKeyword(lowerDesc: string, keyword: string): boolean {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
    return regex.test(lowerDesc);
}

function resolveAvailableCategory(catName: string, availableCategories: string[]): string | null {
    const targetLower = catName.toLowerCase();
    const exact = availableCategories.find((c) => c.toLowerCase() === targetLower);
    if (exact) return exact;

    const partial = availableCategories.find(
        (c) => c.toLowerCase().includes(targetLower) || targetLower.includes(c.toLowerCase())
    );
    if (partial) return partial;

    const aliases = CATEGORY_LEGACY_ALIASES[catName] || [];
    for (const alias of aliases) {
        const aliasMatch = availableCategories.find(
            (c) =>
                c.toLowerCase() === alias ||
                c.toLowerCase().includes(alias) ||
                alias.includes(c.toLowerCase())
        );
        if (aliasMatch) return aliasMatch;
    }

    return null;
}

function detectCategory(description: string, availableCategories: string[]): string | null {
    if (!description.trim() || availableCategories.length === 0) return null;
    const lower = description.toLowerCase();

    let bestMatch: { catName: string; specificity: number; priority: number } | null = null;

    for (const catName of CATEGORY_PRIORITY_ORDER) {
        const keywords = CATEGORY_KEYWORDS[catName] || [];
        const priority = CATEGORY_PRIORITY_ORDER.indexOf(catName);

        for (const kw of keywords) {
            if (matchesKeyword(lower, kw)) {
                const specificity = kw.length + (kw.includes(' ') ? 10 : 0);
                if (
                    !bestMatch ||
                    specificity > bestMatch.specificity ||
                    (specificity === bestMatch.specificity && priority < bestMatch.priority)
                ) {
                    bestMatch = { catName, specificity, priority };
                }
            }
        }
    }

    if (!bestMatch) return null;
    return resolveAvailableCategory(bestMatch.catName, availableCategories);
}

export function AddPage() {
    const {
        activePerson,
        activeGroup,
        isFormerActiveGroup,
        isRoomArchived,
        isRoomClosed,
        setActiveTab,
        showToast,
    } = useExpense();
    const [mode, setMode] = useState<'expense' | 'split'>('split');

    const { data: rawCategories = [] } = useCategories();
    const categories = rawCategories.length > 0 ? rawCategories : DEFAULT_CATEGORIES;
    const { data: people = [], refetch: refetchPeople, isFetching: isPeopleFetching } = usePeople();

    // Quick Expense Form States
    const [expensePayee, setExpensePayee] = useState(activePerson);
    const [expenseCategory, setExpenseCategory] = useState('');
    const [isExpenseCategoryManual, setIsExpenseCategoryManual] = useState(false);
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDesc, setExpenseDesc] = useState('');

    // Group Split Form States
    const [splitAmount, setSplitAmount] = useState('');
    const [splitDesc, setSplitDesc] = useState('');
    const [splitCategory, setSplitCategory] = useState('');
    const [isSplitCategoryManual, setIsSplitCategoryManual] = useState(false);
    const [splitPaidBy, setSplitPaidBy] = useState(activePerson);
    const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
    const [recordExpense, setRecordExpense] = useState(true);

    // Optional Contribution
    const [hasContribution, setHasContribution] = useState(false);
    const [contributionPerson, setContributionPerson] = useState('');
    const [contributionAmt, setContributionAmt] = useState('');

    // Step 4: Split Distribution Mode (Equal vs Shares/Weights)
    const [splitDistributionMode, setSplitDistributionMode] = useState<'EQUAL' | 'SHARES'>('EQUAL');
    const [shares, setShares] = useState<Record<string, number>>({});

    const addExpenseMutation = useAddExpenseMutation();
    const addSplitMutation = useAddSplitMutation();

    // Derived defaults when not explicitly selected (or when active room changes)
    const defaultCategory =
        categories.find((c) => c.toLowerCase() === 'food & dining') ||
        categories[0] ||
        'Food & Dining';
    const activeExpenseCategory = expenseCategory || defaultCategory;
    const activeSplitCategory = splitCategory || defaultCategory;
    const activeExpensePayee =
        people.length === 0 || people.includes(expensePayee)
            ? expensePayee || activePerson
            : people.includes(activePerson)
              ? activePerson
              : people[0] || activePerson;
    const activeSplitPaidBy =
        people.length === 0 || people.includes(splitPaidBy)
            ? splitPaidBy || activePerson
            : people.includes(activePerson)
              ? activePerson
              : people[0] || activePerson;
    const validSelectedParticipants = selectedParticipants.filter((p) => people.includes(p));
    const activeParticipants =
        validSelectedParticipants.length > 0 ? validSelectedParticipants : people;
    const activeContributionPerson =
        contributionPerson && people.includes(contributionPerson)
            ? contributionPerson
            : people[0] || '';

    const adjustShare = (person: string, delta: number) => {
        triggerHaptic('light');
        setShares((prev) => {
            const current = prev[person] !== undefined ? prev[person] : 1;
            const next = Math.max(0, Math.min(10, current + delta));
            return { ...prev, [person]: next };
        });
    };

    // Calculate shares and penny-perfect distribution
    const splitAmountNum = parseFloat(splitAmount) || 0;
    const totalShares = activeParticipants.reduce(
        (sum, p) => sum + (shares[p] !== undefined ? shares[p] : 1),
        0
    );

    const computedShares: Record<string, number> = {};
    if (totalShares > 0 && splitAmountNum > 0) {
        let distributedSum = 0;
        const participating = activeParticipants.filter(
            (p) => (shares[p] !== undefined ? shares[p] : 1) > 0
        );
        participating.forEach((p, idx) => {
            const weight = shares[p] !== undefined ? shares[p] : 1;
            if (idx === participating.length - 1) {
                computedShares[p] = Math.max(0, Math.round((splitAmountNum - distributedSum) * 100) / 100);
            } else {
                const shareAmt = Math.round(((weight / totalShares) * splitAmountNum) * 100) / 100;
                computedShares[p] = shareAmt;
                distributedSum += shareAmt;
            }
        });
    }

    const handleAmountInput = (val: string, setter: (v: string) => void) => {
        const cleaned = val.replace(/[^0-9.]/g, '');
        const parts = cleaned.split('.');
        if (parts.length > 2) return;
        if (parts[1] && parts[1].length > 2) return;
        setter(cleaned);
    };

    const handleQuickIncrement = (inc: number, currentVal: string, setter: (v: string) => void) => {
        triggerHaptic('light');
        const current = parseFloat(currentVal) || 0;
        setter((current + inc).toString());
    };

    const handleClearAmount = (setter: (v: string) => void) => {
        triggerHaptic('light');
        setter('');
    };

    const handleSplitDescChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDesc = e.target.value;
        setSplitDesc(newDesc);
        if (!isSplitCategoryManual) {
            const detected = detectCategory(newDesc, categories);
            if (detected && detected !== splitCategory) {
                setSplitCategory(detected);
            }
        }
    };

    const handleExpenseDescChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDesc = e.target.value;
        setExpenseDesc(newDesc);
        if (!isExpenseCategoryManual) {
            const detected = detectCategory(newDesc, categories);
            if (detected && detected !== expenseCategory) {
                setExpenseCategory(detected);
            }
        }
    };

    const handleQuickExpenseSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(expenseAmount);
        if (!amt || !expenseDesc || !activeExpenseCategory) {
            triggerHaptic('warning');
            return;
        }

        try {
            const res = await addExpenseMutation.mutateAsync({
                payee: activeExpensePayee,
                category: activeExpenseCategory,
                amount: amt,
                description: expenseDesc,
            });
            triggerHaptic('success');
            if ((res as { offline?: boolean })?.offline || !navigator.onLine) {
                showToast(`Saved ₹${amt} offline! Will sync automatically when connected.`, 'cloud_off');
            } else {
                showToast(`Recorded expense of ₹${amt} for ${expenseDesc}!`);
            }
            setExpenseAmount('');
            setExpenseDesc('');
            setIsExpenseCategoryManual(false);
            setActiveTab('dashboard');
        } catch (err: unknown) {
            triggerHaptic('warning');
            showToast(`Error adding expense: ${String(err)}`, 'error');
        }
    };

    const handleGroupSplitSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(splitAmount);
        if (!amt || !splitDesc || !activeSplitCategory || activeParticipants.length === 0) {
            triggerHaptic('warning');
            return;
        }

        const isSharesMode = splitDistributionMode === 'SHARES';
        const participatingPeople = isSharesMode
            ? activeParticipants.filter((p) => (shares[p] !== undefined ? shares[p] : 1) > 0)
            : activeParticipants;

        if (participatingPeople.length === 0) {
            triggerHaptic('warning');
            showToast('Please select at least one participant with a share > 0', 'warning');
            return;
        }

        const customShares = isSharesMode
            ? participatingPeople.map((p) => ({ person: p, share: computedShares[p] || 0 }))
            : undefined;

        const contributions =
            hasContribution && contributionAmt && activeContributionPerson
                ? [{ person: activeContributionPerson, amount: parseFloat(contributionAmt) }]
                : [];

        try {
            await addSplitMutation.mutateAsync({
                amount: amt,
                description: splitDesc,
                category: activeSplitCategory,
                paidBy: activeSplitPaidBy,
                createdBy: activePerson,
                participants: participatingPeople,
                contributions,
                recordExpense,
                splitMode: isSharesMode ? 'CUSTOM' : 'EQUAL',
                customShares,
            });
            triggerHaptic('success');
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                showToast(`Split saved offline! Will sync automatically when connected.`, 'cloud_off');
            } else {
                showToast(`Created split for ${splitDesc} (₹${amt})!`);
            }
            setSplitAmount('');
            setSplitDesc('');
            setHasContribution(false);
            setContributionAmt('');
            setIsSplitCategoryManual(false);
            setActiveTab('splits');
        } catch (err: unknown) {
            triggerHaptic('warning');
            showToast(`Error creating split: ${String(err)}`, 'error');
        }
    };

    const toggleParticipant = (person: string) => {
        triggerHaptic('light');
        const currentList = selectedParticipants.length > 0 ? selectedParticipants : people;
        if (currentList.includes(person)) {
            if (currentList.length > 1) {
                setSelectedParticipants(currentList.filter((p) => p !== person));
            }
        } else {
            setSelectedParticipants([...currentList, person]);
        }
    };

    const selectAllParticipants = () => {
        triggerHaptic('light');
        setSelectedParticipants(people);
    };

    const handleModeSwitch = (newMode: 'expense' | 'split') => {
        triggerHaptic('medium');
        setMode(newMode);
    };

    if (isFormerActiveGroup || isRoomArchived || isRoomClosed) {
        const title = isFormerActiveGroup
            ? 'Former Membership (Read-Only)'
            : isRoomClosed
              ? 'Room is Closed (Read-Only)'
              : 'Room is Archived';

        const description = isFormerActiveGroup
            ? `You are viewing historical records for ${activeGroup?.name || 'this room'}. New expenses cannot be added.`
            : isRoomClosed
              ? `"${activeGroup?.name || 'This room'}" has been permanently closed. All debts are settled and records are frozen.`
              : `"${activeGroup?.name || 'This room'}" is currently archived. New expenses are disabled, but you can still settle remaining debts under Splits.`;

        const icon = isRoomArchived ? 'inventory_2' : 'lock';

        return (
            <div className="flex flex-col w-full pb-12 space-y-4 pt-2">
                <div className="p-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 text-center space-y-3 shadow-xs">
                    <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
                            isRoomArchived
                                ? 'bg-tertiary/15 text-tertiary'
                                : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                    >
                        <AppIcon name={icon} className="text-[24px]" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-base font-bold text-on-surface font-headline">
                            {title}
                        </h2>
                        <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
                            {description}
                        </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab('splits')}
                            className="h-10 px-4 rounded-xl bg-primary text-on-primary text-xs font-bold cursor-pointer"
                        >
                            View Splits
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('groups')}
                            className="h-10 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-xs font-semibold text-on-surface cursor-pointer"
                        >
                            Room Settings
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full pb-12 space-y-4">
            {/* Header */}
            <div className="pt-1 flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline">
                        Add New Record
                    </h1>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                        Record an expense or split mapped to this room
                    </p>
                </div>
                {activeGroup && (
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic('light');
                            setActiveTab('groups');
                        }}
                        className="mt-0.5 h-7 px-2.5 rounded-full bg-primary/10 hover:bg-primary/15 border border-primary/25 text-primary text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0 max-w-[140px]"
                        title={`Mapped to ${activeGroup.name} • Tap to switch room`}
                    >
                        <AppIcon name={activeGroup.icon || 'groups'} className="text-[13px] shrink-0" />
                        <span className="truncate">{activeGroup.name}</span>
                    </button>
                )}
            </div>

            {/* Mode Switcher Toggle */}
            <div className="grid grid-cols-2 gap-2 bg-surface-container-low p-1 rounded-xl border border-outline-variant/30">
                <button
                    type="button"
                    onClick={() => handleModeSwitch('split')}
                    className={`h-10 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        mode === 'split'
                            ? 'bg-surface-container-lowest text-primary shadow-xs'
                            : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                >
                    <AppIcon name="call_split" className="text-[18px]" />
                    <span>Group Split</span>
                </button>
                <button
                    type="button"
                    onClick={() => handleModeSwitch('expense')}
                    className={`h-10 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        mode === 'expense'
                            ? 'bg-surface-container-lowest text-primary shadow-xs'
                            : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                >
                    <AppIcon name="receipt" className="text-[18px]" />
                    <span>Single Expense</span>
                </button>
            </div>

            {/* MODE 1: Group Split Form */}
            {mode === 'split' && (
                <form onSubmit={handleGroupSplitSubmit} className="space-y-4">
                    {/* Amount Input with Quick-Add Chips */}
                    <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-xs border border-outline-variant/30 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all flex flex-col items-center justify-center text-center space-y-3">
                        <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider font-mono">
                            Total Bill Amount
                        </span>
                        <div className="flex items-center justify-center gap-1.5 w-full">
                            <span className="text-3xl font-bold text-primary font-mono">
                                ₹
                            </span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={splitAmount}
                                onChange={(e) => handleAmountInput(e.target.value, setSplitAmount)}
                                placeholder="0"
                                className="text-3xl font-bold text-on-surface bg-transparent text-center focus:outline-none w-48 tracking-tight font-mono"
                                required
                            />
                        </div>

                        {/* Quick-add Chips */}
                        <div className="flex items-center gap-1.5 flex-wrap justify-center pt-1 border-t border-outline-variant/15 w-full">
                            {QUICK_INCREMENTS.map((inc) => (
                                <button
                                    key={inc}
                                    type="button"
                                    onClick={() => handleQuickIncrement(inc, splitAmount, setSplitAmount)}
                                    className="px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-mono text-xs font-semibold border border-outline-variant/20 transition-all active:scale-95 cursor-pointer"
                                >
                                    +₹{inc}
                                </button>
                            ))}
                            {splitAmount && (
                                <button
                                    type="button"
                                    onClick={() => handleClearAmount(setSplitAmount)}
                                    className="px-2.5 py-1 rounded-lg bg-error-container/30 hover:bg-error-container/50 text-error font-mono text-xs font-semibold border border-error/20 transition-all active:scale-95 cursor-pointer"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Description with Smart Auto-detection */}
                    <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-xs border border-outline-variant/30 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-on-surface-variant block">
                                Description
                            </label>
                            {detectCategory(splitDesc, categories) && !isSplitCategoryManual && (
                                <span className="text-[10px] text-primary font-semibold flex items-center gap-0.5 animate-in fade-in">
                                    <AppIcon name="auto_awesome" className="text-[13px]" />
                                    <span>Category: {activeSplitCategory}</span>
                                </span>
                            )}
                        </div>
                        <input
                            type="text"
                            value={splitDesc}
                            onChange={handleSplitDescChange}
                            placeholder="e.g. Lunch at Dhaba, Paragliding, Local Cab"
                            className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-sm text-on-surface focus:outline-none border border-outline-variant/20"
                            required
                        />
                    </div>

                    {/* Category Selector */}
                    <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-xs border border-outline-variant/30 space-y-2">
                        <label className="text-xs font-semibold text-on-surface-variant block">
                            Category
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic('light');
                                        setIsSplitCategoryManual(true);
                                        setSplitCategory(cat);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                                        activeSplitCategory === cat
                                            ? 'bg-primary text-on-primary border-primary shadow-2xs'
                                            : 'bg-surface-container-low text-on-surface-variant border-outline-variant/20 hover:bg-surface-container'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Paid By */}
                    <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-xs border border-outline-variant/30 space-y-2">
                        <label className="text-xs font-semibold text-on-surface-variant block">
                            Paid By
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {people.length === 0 && isPeopleFetching ? (
                                <>
                                    <span className="h-8 w-20 rounded-full bg-outline-variant/25 animate-pulse" />
                                    <span className="h-8 w-24 rounded-full bg-outline-variant/25 animate-pulse" />
                                    <span className="h-8 w-16 rounded-full bg-outline-variant/25 animate-pulse" />
                                </>
                            ) : (
                                people.map((person) => (
                                    <button
                                        key={person}
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic('light');
                                            setSplitPaidBy(person);
                                        }}
                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                                            activeSplitPaidBy === person
                                                ? 'bg-primary text-on-primary border-primary shadow-2xs'
                                                : 'bg-surface-container-low text-on-surface border-outline-variant/20 hover:bg-surface-container'
                                        }`}
                                    >
                                        {person === activePerson ? `${person} (You)` : person}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Participants & Split Distribution Mode */}
                    <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-xs border border-outline-variant/30 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-on-surface uppercase tracking-wider font-mono truncate min-w-0">
                                Split Between ({activeParticipants.length} people)
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            await apiFetch('/people?refresh=true');
                                            await refetchPeople();
                                            showToast('Refreshed member list from Sheet!', 'sync');
                                        } catch {
                                            showToast('Failed to refresh members', 'error');
                                        }
                                    }}
                                    disabled={isPeopleFetching}
                                    className="h-7 w-7 sm:w-auto sm:px-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors cursor-pointer flex items-center justify-center sm:justify-start gap-1 text-[11px] font-semibold border border-outline-variant/20 shadow-2xs whitespace-nowrap shrink-0"
                                    title="Reload members from Google Sheet"
                                    aria-label="Reload members"
                                >
                                    <AppIcon
                                        name="sync"
                                        className={`text-[15px] ${isPeopleFetching ? 'animate-spin text-primary' : ''}`}
                                    />
                                    <span className="hidden sm:inline">Reload</span>
                                </button>
                                {splitDistributionMode === 'EQUAL' && (
                                    <button
                                        type="button"
                                        onClick={selectAllParticipants}
                                        className="h-7 px-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary hover:text-primary-container text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 border border-outline-variant/20 shadow-2xs active:scale-95"
                                        title="Select all members"
                                        aria-label="Select all members"
                                    >
                                        <AppIcon name="select_all" className="text-[15px]" />
                                        <span>Select All</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Split Mode Segmented Switcher */}
                        <div className="flex rounded-xl bg-surface-container p-1 border border-outline-variant/20">
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic('light');
                                    setSplitDistributionMode('EQUAL');
                                }}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                    splitDistributionMode === 'EQUAL'
                                        ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                                        : 'text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                <AppIcon name="equal" className="text-[16px]" />
                                <span>Equal Split</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic('light');
                                    setSplitDistributionMode('SHARES');
                                }}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                    splitDistributionMode === 'SHARES'
                                        ? 'bg-surface-container-lowest text-primary shadow-xs'
                                        : 'text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                <AppIcon name="pie_chart" className="text-[16px]" />
                                <span>Shares / Weights</span>
                            </button>
                        </div>

                        {splitDistributionMode === 'EQUAL' ? (
                            /* Equal Split: 2-column checklist */
                            <div className="grid grid-cols-2 gap-2">
                                {people.length === 0 && isPeopleFetching ? (
                                    <>
                                        <div className="h-10 rounded-xl bg-outline-variant/20 animate-pulse" />
                                        <div className="h-10 rounded-xl bg-outline-variant/20 animate-pulse" />
                                        <div className="h-10 rounded-xl bg-outline-variant/20 animate-pulse" />
                                        <div className="h-10 rounded-xl bg-outline-variant/20 animate-pulse" />
                                    </>
                                ) : (
                                    people.map((person) => {
                                        const isChecked = activeParticipants.includes(person);
                                        return (
                                            <button
                                                key={person}
                                                type="button"
                                                onClick={() => toggleParticipant(person)}
                                                className={`p-2.5 rounded-xl flex items-center justify-between text-xs font-semibold transition-colors cursor-pointer border ${
                                                    isChecked
                                                        ? 'bg-primary-fixed/30 border-primary/40 text-on-surface'
                                                        : 'bg-surface-container-low border-outline-variant/20 text-on-surface-variant'
                                                }`}
                                            >
                                                <span>{person}</span>
                                                {isChecked && (
                                                    <AppIcon name="check" className="text-primary text-[18px]" />
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        ) : (
                            /* Shares / Weights: Stepper for couples, kids, unequal */
                            <div className="space-y-2">
                                {splitAmountNum > 0 && totalShares > 0 && (
                                    <div className="px-3 py-2 rounded-xl bg-secondary-fixed/20 border border-secondary/20 flex items-center justify-between text-xs text-on-secondary-fixed font-medium">
                                        <span>Total: {totalShares} shares</span>
                                        <span className="font-mono font-bold">
                                            ₹{(splitAmountNum / totalShares).toFixed(2)} / share
                                        </span>
                                    </div>
                                )}

                                {people.map((person) => {
                                    const weight = shares[person] !== undefined ? shares[person] : 1;
                                    const isExcluded = weight === 0;
                                    const amountForPerson = computedShares[person] || 0;

                                    return (
                                        <div
                                            key={person}
                                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                                                isExcluded
                                                    ? 'bg-surface-container-low/50 border-outline-variant/20 opacity-60'
                                                    : 'bg-surface-container-low border-outline-variant/30'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <Avatar name={person} size="sm" />
                                                <div className="min-w-0">
                                                    <span className="font-semibold text-xs text-on-surface block truncate">
                                                        {person}
                                                    </span>
                                                    <span className="text-[11px] text-on-surface-variant font-mono">
                                                        {isExcluded ? '0 shares (Excluded)' : `₹${amountForPerson.toLocaleString('en-IN')}`}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Stepper [-] [ 1x ] [+] */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    disabled={weight <= 0}
                                                    onClick={() => adjustShare(person, -1)}
                                                    aria-label={`Decrease share for ${person}`}
                                                    className="w-8 h-8 rounded-lg bg-surface-container-highest text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer"
                                                >
                                                    <AppIcon name="remove" className="text-[16px]" />
                                                </button>
                                                <span className="w-8 text-center font-mono font-bold text-xs text-on-surface">
                                                    {weight}x
                                                </span>
                                                <button
                                                    type="button"
                                                    disabled={weight >= 10}
                                                    onClick={() => adjustShare(person, 1)}
                                                    aria-label={`Increase share for ${person}`}
                                                    className="w-8 h-8 rounded-lg bg-primary-fixed text-on-primary-fixed hover:bg-primary hover:text-on-primary flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer"
                                                >
                                                    <AppIcon name="add" className="text-[16px]" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Optional Advance Contribution */}
                    <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-xs border border-outline-variant/30 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-on-surface flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={hasContribution}
                                    onChange={(e) => setHasContribution(e.target.checked)}
                                    className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                                />
                                <span>Record an advance partial contribution</span>
                            </label>
                        </div>

                        {hasContribution && (
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-outline-variant/20">
                                <select
                                    value={activeContributionPerson}
                                    onChange={(e) => setContributionPerson(e.target.value)}
                                    className="h-10 px-2 rounded-xl bg-surface-container-low text-xs font-semibold text-on-surface border border-outline-variant/20"
                                >
                                    {people.map((p) => (
                                        <option key={p} value={p}>
                                            {p}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    min="1"
                                    value={contributionAmt}
                                    onChange={(e) => setContributionAmt(e.target.value)}
                                    placeholder="Amount (₹)"
                                    className="h-10 px-3 rounded-xl bg-surface-container-low text-xs font-mono font-bold text-on-surface border border-outline-variant/20"
                                />
                            </div>
                        )}
                    </div>

                    {/* Record Expense in room log checkbox */}
                    <div className="p-3 rounded-xl bg-surface-container-low flex items-center justify-between border border-outline-variant/20">
                        <span className="text-xs text-on-surface font-semibold">
                            Record in {activeGroup?.name || 'room'} expense log
                        </span>
                        <input
                            type="checkbox"
                            checked={recordExpense}
                            onChange={(e) => setRecordExpense(e.target.checked)}
                            className="w-5 h-5 rounded text-primary accent-primary cursor-pointer"
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={addSplitMutation.isPending}
                        className="w-full h-12 rounded-xl bg-primary text-on-primary font-semibold text-sm shadow-md hover:bg-primary-container active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <AppIcon name="call_split" className="text-[20px]" />
                        <span>
                            {addSplitMutation.isPending ? 'Splitting bill...' : 'Create Group Split'}
                        </span>
                    </button>
                </form>
            )}

            {/* MODE 2: Quick Expense Form */}
            {mode === 'expense' && (
                <form onSubmit={handleQuickExpenseSubmit} className="space-y-4">
                    {/* Amount Input with Quick-Add Chips */}
                    <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-xs border border-outline-variant/30 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all flex flex-col items-center justify-center text-center space-y-3">
                        <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider font-mono">
                            Expense Amount
                        </span>
                        <div className="flex items-center justify-center gap-1.5 w-full">
                            <span className="text-3xl font-bold text-primary font-mono">
                                ₹
                            </span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={expenseAmount}
                                onChange={(e) => handleAmountInput(e.target.value, setExpenseAmount)}
                                placeholder="0"
                                className="text-3xl font-bold text-on-surface bg-transparent text-center focus:outline-none w-48 tracking-tight font-mono"
                                required
                            />
                        </div>

                        {/* Quick-add Chips */}
                        <div className="flex items-center gap-1.5 flex-wrap justify-center pt-1 border-t border-outline-variant/15 w-full">
                            {QUICK_INCREMENTS.map((inc) => (
                                <button
                                    key={inc}
                                    type="button"
                                    onClick={() => handleQuickIncrement(inc, expenseAmount, setExpenseAmount)}
                                    className="px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-mono text-xs font-semibold border border-outline-variant/20 transition-all active:scale-95 cursor-pointer"
                                >
                                    +₹{inc}
                                </button>
                            ))}
                            {expenseAmount && (
                                <button
                                    type="button"
                                    onClick={() => handleClearAmount(setExpenseAmount)}
                                    className="px-2.5 py-1 rounded-lg bg-error-container/30 hover:bg-error-container/50 text-error font-mono text-xs font-semibold border border-error/20 transition-all active:scale-95 cursor-pointer"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Description with Smart Auto-detection */}
                    <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-xs border border-outline-variant/30 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-on-surface-variant block">
                                What was this for?
                            </label>
                            {detectCategory(expenseDesc, categories) && !isExpenseCategoryManual && (
                                <span className="text-[10px] text-primary font-semibold flex items-center gap-0.5 animate-in fade-in">
                                    <AppIcon name="auto_awesome" className="text-[13px]" />
                                    <span>Category: {activeExpenseCategory}</span>
                                </span>
                            )}
                        </div>
                        <input
                            type="text"
                            value={expenseDesc}
                            onChange={handleExpenseDescChange}
                            placeholder="e.g. Water Bottles, Tea & Chips, Petrol"
                            className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-sm text-on-surface focus:outline-none border border-outline-variant/20"
                            required
                        />
                    </div>

                    {/* Category Selector */}
                    <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-xs border border-outline-variant/30 space-y-2">
                        <label className="text-xs font-semibold text-on-surface-variant block">
                            Category
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic('light');
                                        setIsExpenseCategoryManual(true);
                                        setExpenseCategory(cat);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                                        activeExpenseCategory === cat
                                            ? 'bg-primary text-on-primary border-primary shadow-2xs'
                                            : 'bg-surface-container-low text-on-surface-variant border-outline-variant/20 hover:bg-surface-container'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Payee / Spender */}
                    <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-xs border border-outline-variant/30 space-y-2">
                        <label className="text-xs font-semibold text-on-surface-variant block">
                            Paid By
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {people.length === 0 && isPeopleFetching ? (
                                <>
                                    <span className="h-8 w-20 rounded-full bg-outline-variant/25 animate-pulse" />
                                    <span className="h-8 w-24 rounded-full bg-outline-variant/25 animate-pulse" />
                                    <span className="h-8 w-16 rounded-full bg-outline-variant/25 animate-pulse" />
                                </>
                            ) : (
                                people.map((person) => (
                                    <button
                                        key={person}
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic('light');
                                            setExpensePayee(person);
                                        }}
                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                                            activeExpensePayee === person
                                                ? 'bg-primary text-on-primary border-primary shadow-2xs'
                                                : 'bg-surface-container-low text-on-surface border-outline-variant/20 hover:bg-surface-container'
                                        }`}
                                    >
                                        {person === activePerson ? `${person} (You)` : person}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={addExpenseMutation.isPending}
                        className="w-full h-12 rounded-xl bg-primary text-on-primary font-semibold text-sm shadow-md hover:bg-primary-container active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <AppIcon name="add_circle" className="text-[20px]" />
                        <span>
                            {addExpenseMutation.isPending ? 'Recording...' : 'Record Expense'}
                        </span>
                    </button>
                </form>
            )}
        </div>
    );
}

export default AddPage;
