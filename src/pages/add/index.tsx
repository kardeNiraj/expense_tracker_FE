import React, { useState } from 'react';
import { useExpense } from '../../context';
import {
    apiFetch,
    useCategories,
    usePeople,
    useAddExpenseMutation,
    useAddSplitMutation,
} from '../../api';
import { triggerHaptic } from '../../utils/haptics';

const QUICK_INCREMENTS = [50, 100, 200, 500];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
    Food: ['food', 'lunch', 'dinner', 'breakfast', 'brunch', 'cafe', 'coffee', 'chai', 'tea', 'pizza', 'burger', 'restaurant', 'biryani', 'snack', 'snacks', 'sweets', 'bakery', 'meal', 'maggi', 'momo', 'momos', 'roti', 'thali', 'paneer', 'dosa'],
    Drinks: ['beer', 'wine', 'alcohol', 'drinks', 'water', 'bottle', 'beverage', 'bar', 'cocktail', 'whiskey', 'vodka', 'rum', 'soda', 'coke', 'juice'],
    Travel: ['cab', 'uber', 'ola', 'taxi', 'auto', 'fuel', 'petrol', 'diesel', 'toll', 'parking', 'flight', 'train', 'bus', 'metro', 'fare', 'rapido'],
    Stay: ['hotel', 'resort', 'room', 'airbnb', 'stay', 'hostel', 'lodge', 'camp', 'tent', 'cottage'],
    Activities: ['ticket', 'paragliding', 'rafting', 'trek', 'skiing', 'ski', 'entry', 'safari', 'pass', 'rental', 'bike', 'scooter', 'cable car', 'ropeway', 'boating'],
    Shopping: ['shopping', 'market', 'mall', 'souvenir', 'clothes', 'groceries', 'mart', 'store'],
};

function detectCategory(description: string, availableCategories: string[]): string | null {
    if (!description.trim() || availableCategories.length === 0) return null;
    const lower = description.toLowerCase();
    for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        const matchedKeyword = keywords.find((kw) => lower.includes(kw));
        if (matchedKeyword) {
            const matchedCat = availableCategories.find(
                (c) =>
                    c.toLowerCase() === catName.toLowerCase() ||
                    c.toLowerCase().includes(catName.toLowerCase()) ||
                    catName.toLowerCase().includes(c.toLowerCase())
            );
            if (matchedCat) return matchedCat;
        }
    }
    return null;
}

export function AddPage() {
    const { activePerson, setActiveTab, showToast } = useExpense();
    const [mode, setMode] = useState<'expense' | 'split'>('split');

    const { data: categories = [] } = useCategories();
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

    const addExpenseMutation = useAddExpenseMutation();
    const addSplitMutation = useAddSplitMutation();

    // Derived defaults when not explicitly selected
    const activeExpenseCategory = expenseCategory || categories[0] || 'Food';
    const activeSplitCategory = splitCategory || categories[0] || 'Food';
    const activeSplitPaidBy = splitPaidBy || activePerson;
    const activeParticipants = selectedParticipants.length > 0 ? selectedParticipants : people;
    const activeContributionPerson = contributionPerson || people[0] || '';

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
            await addExpenseMutation.mutateAsync({
                payee: expensePayee || activePerson,
                category: activeExpenseCategory,
                amount: amt,
                description: expenseDesc,
            });
            triggerHaptic('success');
            showToast(`Recorded expense of ₹${amt} for ${expenseDesc}!`);
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
                participants: activeParticipants,
                contributions,
                recordExpense,
            });
            triggerHaptic('success');
            showToast(`Created split for ${splitDesc} (₹${amt})!`);
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

    return (
        <div className="flex flex-col w-full pb-12 space-y-4">
            {/* Header */}
            <div className="pt-1">
                <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline">
                    Add New Record
                </h1>
                <p className="text-xs text-on-surface-variant mt-0.5">
                    Record a general trip expense or split a group bill
                </p>
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
                    <span className="material-symbols-outlined text-[18px]">
                        call_split
                    </span>
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
                    <span className="material-symbols-outlined text-[18px]">
                        receipt
                    </span>
                    <span>Single Expense</span>
                </button>
            </div>

            {/* MODE 1: Group Split Form */}
            {mode === 'split' && (
                <form onSubmit={handleGroupSplitSubmit} className="space-y-4">
                    {/* Amount Input with Quick-Add Chips */}
                    <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-xs border border-outline-variant/30 flex flex-col items-center justify-center text-center space-y-3">
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
                                    <span className="material-symbols-outlined text-[13px]">
                                        auto_awesome
                                    </span>
                                    <span>Category: {activeSplitCategory}</span>
                                </span>
                            )}
                        </div>
                        <input
                            type="text"
                            value={splitDesc}
                            onChange={handleSplitDescChange}
                            placeholder="e.g. Brunch at Mall Road, Paragliding, Cab"
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
                            {people.map((person) => (
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
                            ))}
                        </div>
                    </div>

                    {/* Participants Checklist */}
                    <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-xs border border-outline-variant/30 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-on-surface uppercase tracking-wider font-mono">
                                Split Between ({activeParticipants.length} people)
                            </span>
                            <div className="flex items-center gap-2">
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
                                    className="p-1 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                                    title="Reload members from Google Sheet"
                                >
                                    <span
                                        className={`material-symbols-outlined text-[15px] ${
                                            isPeopleFetching ? 'animate-spin text-primary' : ''
                                        }`}
                                    >
                                        sync
                                    </span>
                                    <span>Reload</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={selectAllParticipants}
                                    className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                                >
                                    Select All
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {people.map((person) => {
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
                                            <span className="material-symbols-outlined text-primary text-[18px]">
                                                check
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
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
                                    value={contributionPerson}
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

                    {/* Record Expense in Sheet checkbox */}
                    <div className="p-3 rounded-xl bg-surface-container-low flex items-center justify-between border border-outline-variant/20">
                        <span className="text-xs text-on-surface font-semibold">
                            Record in October 2026 Expense Sheet
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
                        <span className="material-symbols-outlined text-[20px]">
                            call_split
                        </span>
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
                    <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-xs border border-outline-variant/30 flex flex-col items-center justify-center text-center space-y-3">
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
                                    <span className="material-symbols-outlined text-[13px]">
                                        auto_awesome
                                    </span>
                                    <span>Category: {activeExpenseCategory}</span>
                                </span>
                            )}
                        </div>
                        <input
                            type="text"
                            value={expenseDesc}
                            onChange={handleExpenseDescChange}
                            placeholder="e.g. Water Bottle, Snacks, Entry Ticket"
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
                            {people.map((person) => (
                                <button
                                    key={person}
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic('light');
                                        setExpensePayee(person);
                                    }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                                        (expensePayee || activePerson) === person
                                            ? 'bg-primary text-on-primary border-primary shadow-2xs'
                                            : 'bg-surface-container-low text-on-surface border-outline-variant/20 hover:bg-surface-container'
                                    }`}
                                >
                                    {person === activePerson ? `${person} (You)` : person}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={addExpenseMutation.isPending}
                        className="w-full h-12 rounded-xl bg-primary text-on-primary font-semibold text-sm shadow-md hover:bg-primary-container active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            add_circle
                        </span>
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
