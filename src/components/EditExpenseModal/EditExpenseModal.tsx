import React, { useState, useEffect } from 'react';
import { useCategories } from '../../api';
import { useUpdateExpenseMutation } from '../../api/mutations';
import { useExpense } from '../../context';
import { triggerHaptic } from '../../utils/haptics';
import { DEFAULT_CATEGORIES } from '../../config';
import { getCategoryMeta } from '../../utils/formatters';
import { AppIcon } from '../Icon/AppIcon';

export interface EditExpenseItem {
    id: string;
    description: string;
    amount: number;
    category?: string;
    timestamp?: string;
    payee?: string;
}

export interface EditExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    expense: EditExpenseItem | null;
}

export const EditExpenseModal: React.FC<EditExpenseModalProps> = ({
    isOpen,
    onClose,
    expense,
}) => {
    const { showToast, activePerson } = useExpense();
    const { data: rawCategories = [] } = useCategories();
    const categories = rawCategories.length > 0 ? rawCategories : DEFAULT_CATEGORIES;
    const updateMutation = useUpdateExpenseMutation();

    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');

    useEffect(() => {
        if (expense) {
            setAmount(String(expense.amount));
            setDescription(expense.description);
            setCategory(expense.category || 'Food & Dining');
        }
    }, [expense]);

    if (!isOpen || !expense) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            showToast('Please enter a valid positive amount', 'warning');
            triggerHaptic('warning');
            return;
        }

        if (!description.trim() || description.trim().length < 2) {
            showToast('Please enter a description (at least 2 characters)', 'warning');
            triggerHaptic('warning');
            return;
        }

        try {
            await updateMutation.mutateAsync({
                expenseId: expense.id,
                amount: numAmount,
                description: description.trim(),
                category: category.trim(),
                requestedBy: activePerson || expense.payee,
            });

            triggerHaptic('success');
            showToast('Expense updated successfully', 'success');
            onClose();
        } catch (err: any) {
            triggerHaptic('warning');
            showToast(err?.message || 'Failed to update expense', 'error');
        }
    };

    return (
        <div
            className="fixed inset-0 z-70 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-surface-container-lowest border-t sm:border border-outline-variant/30 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 space-y-5 animate-in slide-in-from-bottom duration-250 select-none max-h-[90vh] overflow-y-auto"
            >
                {/* Pull handle on mobile */}
                <div className="w-10 h-1 rounded-full bg-outline-variant/50 mx-auto -mt-2 mb-1 sm:hidden" />

                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <AppIcon name="edit" className="text-[20px]" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-on-surface leading-tight">Edit Transaction</h2>
                            <p className="text-[11px] text-on-surface-variant">Update description, amount, or category</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors cursor-pointer"
                    >
                        <AppIcon name="close" className="text-[18px]" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Amount Input */}
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                            Amount (₹)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-on-surface-variant">
                                ₹
                            </span>
                            <input
                                type="number"
                                step="any"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                required
                                className="w-full h-12 pl-9 pr-4 rounded-xl bg-surface-container-low border border-outline-variant/30 text-lg font-bold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
                            />
                        </div>
                    </div>

                    {/* Description Input */}
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                            Description
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What was this expense for?"
                            required
                            className="w-full h-12 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        />
                    </div>

                    {/* Category Selector */}
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                            Category
                        </label>
                        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1 rounded-xl bg-surface-container-low border border-outline-variant/20">
                            {categories.map((catName) => {
                                const isSelected = category === catName;
                                const meta = getCategoryMeta(catName);
                                return (
                                    <button
                                        key={catName}
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic('light');
                                            setCategory(catName);
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                            isSelected
                                                ? 'bg-primary text-on-primary shadow-xs font-bold'
                                                : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                                        }`}
                                    >
                                        <AppIcon
                                            name={meta.icon}
                                            className={`text-[15px] ${isSelected ? 'text-on-primary' : meta.textClass}`}
                                        />
                                        <span>{catName}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Timestamp info if available */}
                    {expense.timestamp && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container-low/60 text-xs text-on-surface-variant">
                            <AppIcon name="schedule" className="text-[16px] text-primary shrink-0" />
                            <span>Logged at: <strong className="text-on-surface font-mono">{expense.timestamp}</strong></span>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 pt-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-12 rounded-xl border border-outline-variant/30 text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={updateMutation.isPending}
                            className="flex-1 h-12 rounded-xl bg-primary text-on-primary text-sm font-bold shadow-md hover:bg-primary-hover active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {updateMutation.isPending ? (
                                <>
                                    <AppIcon name="hourglass_top" className="text-[18px] animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <AppIcon name="check" className="text-[18px]" />
                                    <span>Save Changes</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditExpenseModal;
