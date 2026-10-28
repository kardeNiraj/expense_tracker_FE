import React, { useState } from 'react';
import type { Split } from '../../api/types';
import { useCategories, usePeople, useUpdateSplitMutation } from '../../api';
import { useExpense } from '../../context';
import { triggerHaptic } from '../../utils/haptics';

export interface EditSplitModalProps {
    isOpen: boolean;
    onClose: () => void;
    split: Split | null;
}

interface EditSplitContentProps {
    split: Split;
    onClose: () => void;
}

const QUICK_INCREMENTS = [50, 100, 200, 500];

const EditSplitContent: React.FC<EditSplitContentProps> = ({ split, onClose }) => {
    const { activePerson, showToast } = useExpense();
    const { data: categories = [] } = useCategories();
    const { data: people = [] } = usePeople();
    const updateMutation = useUpdateSplitMutation();

    const [amount, setAmount] = useState(String(split.totalAmount));
    const [description, setDescription] = useState(split.description);
    const [category, setCategory] = useState(split.category);
    const [participants, setParticipants] = useState<string[]>(split.participants || []);
    const [isSaving, setIsSaving] = useState(false);

    const settledCount = (split.settlements || []).filter((s) => s.status === 'SETTLED').length;
    const hasSettled = settledCount > 0;

    const toggleParticipant = (person: string) => {
        if (hasSettled) return;
        triggerHaptic('light');
        if (participants.includes(person)) {
            if (participants.length > 1) {
                setParticipants(participants.filter((p) => p !== person));
            } else {
                showToast('At least 1 participant is required', 'warning');
            }
        } else {
            setParticipants([...participants, person]);
        }
    };

    const handleAmountChange = (val: string) => {
        const cleaned = val.replace(/[^0-9.]/g, '');
        const parts = cleaned.split('.');
        if (parts.length > 2) return;
        if (parts[1] && parts[1].length > 2) return;
        setAmount(cleaned);
    };

    const handleQuickIncrement = (inc: number) => {
        triggerHaptic('light');
        const curr = parseFloat(amount) || 0;
        setAmount(String(curr + inc));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const amtNum = parseFloat(amount);
        if (!amtNum || amtNum <= 0) {
            triggerHaptic('warning');
            showToast('Please enter a valid amount', 'warning');
            return;
        }

        if (!description.trim()) {
            triggerHaptic('warning');
            showToast('Please enter a description', 'warning');
            return;
        }

        if (participants.length === 0) {
            triggerHaptic('warning');
            showToast('Please select at least 1 participant', 'warning');
            return;
        }

        setIsSaving(true);
        try {
            await updateMutation.mutateAsync({
                splitId: split.splitId,
                amount: amtNum,
                description: description.trim(),
                category: category || split.category,
                participants,
                requestedBy: activePerson,
            });
            triggerHaptic('success');
            showToast('Split updated successfully!', 'check_circle');
            onClose();
        } catch (err: unknown) {
            triggerHaptic('warning');
            showToast(`Failed to update split: ${String(err)}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl border border-outline-variant/30 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Drag Handle (Mobile) */}
                <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
                    <div className="w-10 h-1 rounded-full bg-outline-variant/60" />
                </div>

                {/* Header */}
                <div className="p-4 border-b border-outline-variant/20 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-base text-on-surface truncate">Edit Split</h3>
                            <p className="text-xs text-on-surface-variant truncate">
                                Paid by {split.paidBy} • Created by {split.createdBy || split.paidBy}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer shrink-0"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Scrollable Form Body */}
                <form id="edit-split-form" onSubmit={handleSubmit} className="p-4 overflow-y-auto overscroll-contain flex-1 space-y-4">
                    {/* Guard Alert if partial dues are settled */}
                    {hasSettled && (
                        <div className="p-3 rounded-xl bg-secondary-fixed/20 border border-secondary/30 flex items-start gap-2.5 text-xs text-on-surface">
                            <span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">
                                lock
                            </span>
                            <div className="space-y-0.5">
                                <span className="font-bold block">Amount & Participants Locked</span>
                                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                                    {settledCount} member(s) have already settled their dues. To protect accounting integrity, you can only edit the description and category.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Amount Input */}
                    <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/30 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider font-mono">
                                Total Bill Amount (₹)
                            </label>
                            {hasSettled && (
                                <span className="text-[10px] font-semibold text-secondary flex items-center gap-0.5">
                                    <span className="material-symbols-outlined text-[12px]">lock</span>
                                    <span>Locked</span>
                                </span>
                            )}
                        </div>

                        <div className="flex items-center justify-center gap-1.5 py-1">
                            <span className="text-2xl font-bold text-primary font-mono">₹</span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={amount}
                                disabled={hasSettled}
                                onChange={(e) => handleAmountChange(e.target.value)}
                                placeholder="0"
                                className={`text-2xl font-bold text-on-surface bg-transparent text-center focus:outline-hidden w-40 tracking-tight font-mono ${
                                    hasSettled ? 'opacity-60 cursor-not-allowed' : ''
                                }`}
                                required
                            />
                        </div>

                        {!hasSettled && (
                            <div className="flex items-center gap-1.5 flex-wrap justify-center pt-2 border-t border-outline-variant/15">
                                {QUICK_INCREMENTS.map((inc) => (
                                    <button
                                        key={inc}
                                        type="button"
                                        onClick={() => handleQuickIncrement(inc)}
                                        className="px-2 py-0.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-mono text-[11px] font-semibold border border-outline-variant/20 transition-all active:scale-95 cursor-pointer"
                                    >
                                        +₹{inc}
                                    </button>
                                ))}
                                {amount && (
                                    <button
                                        type="button"
                                        onClick={() => setAmount('')}
                                        className="px-2 py-0.5 rounded-lg bg-error-container/30 hover:bg-error-container/50 text-error font-mono text-[11px] font-semibold border border-error/20 transition-all active:scale-95 cursor-pointer"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant block">
                            Description / What was this for?
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g. Dinner at Johnson's Cafe"
                            className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm text-on-surface focus:outline-hidden focus:border-primary"
                            required
                        />
                    </div>

                    {/* Category Selector */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant block">
                            Category
                        </label>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic('light');
                                        setCategory(cat);
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                                        category.toLowerCase() === cat.toLowerCase()
                                            ? 'bg-primary text-on-primary border-primary shadow-xs'
                                            : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:bg-surface-container'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Participants Checklist */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-on-surface-variant block">
                                Participants ({participants.length} people)
                            </label>
                            {hasSettled && (
                                <span className="text-[10px] text-on-surface-variant font-mono">
                                    Locked due to settled dues
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {people.map((person) => {
                                const isChecked = participants.includes(person);
                                return (
                                    <button
                                        key={person}
                                        type="button"
                                        disabled={hasSettled}
                                        onClick={() => toggleParticipant(person)}
                                        className={`p-2.5 rounded-xl flex items-center justify-between text-xs font-semibold transition-all border ${
                                            hasSettled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                                        } ${
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
                </form>

                {/* Footer Buttons */}
                <div className="p-4 border-t border-outline-variant/20 bg-surface-container-lowest shrink-0 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 h-11 rounded-xl border border-outline-variant/40 text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="edit-split-form"
                        disabled={isSaving}
                        className="flex-1 h-11 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-xs hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined text-[16px]">
                            {isSaving ? 'hourglass_top' : 'check'}
                        </span>
                        <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export const EditSplitModal: React.FC<EditSplitModalProps> = ({ isOpen, onClose, split }) => {
    if (!isOpen || !split) return null;

    return (
        <EditSplitContent
            key={`${split.splitId}-${split.totalAmount}-${split.description}`}
            split={split}
            onClose={onClose}
        />
    );
};

