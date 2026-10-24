import React, { useState } from 'react';
import { useExpense } from '../../context';
import { usePeopleDetails, useUpdateUpiMutation, usePeople } from '../../api';
import { Avatar } from '../../components';
import type { PersonDetail } from '../../api/types';

export function PeoplePage() {
    const { activePerson, setActivePerson, showToast } = useExpense();
    const { data: peopleDetails = [], isLoading, refetch } = usePeopleDetails();
    const { refetch: refetchPeople } = usePeople(true);
    const updateUpiMutation = useUpdateUpiMutation();

    const [editingPerson, setEditingPerson] = useState<PersonDetail | null>(null);
    const [upiInput, setUpiInput] = useState('');

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast(`Copied UPI ID: ${text}`, 'content_copy');
    };

    const handleSaveUpi = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPerson || !upiInput.trim()) return;

        try {
            await updateUpiMutation.mutateAsync({
                name: editingPerson.name,
                upiId: upiInput.trim(),
            });
            showToast(`Updated UPI ID for ${editingPerson.name}!`);
            setEditingPerson(null);
            setUpiInput('');
        } catch (err: unknown) {
            showToast(`Failed to update UPI: ${String(err)}`, 'error');
        }
    };

    const handleRefreshCache = () => {
        refetch();
        refetchPeople();
        showToast('Refreshed directory cache from server', 'sync');
    };

    return (
        <div className="flex flex-col w-full pb-12 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pt-1">
                <div>
                    <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline">
                        Trip Directory & UPI
                    </h1>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                        Manage members and payment settlement addresses
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleRefreshCache}
                    className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer border border-outline-variant/30"
                    title="Refresh Cache from Server"
                >
                    <span className="material-symbols-outlined text-[18px]">
                        sync
                    </span>
                </button>
            </div>

            {/* People List */}
            {isLoading ? (
                <div className="bg-surface-container-lowest p-8 rounded-2xl text-center text-xs text-on-surface-variant animate-pulse border border-outline-variant/30">
                    Loading trip members from server...
                </div>
            ) : (
                <div className="space-y-3">
                    {peopleDetails.map((person) => {
                        const isCurrent = person.name === activePerson;

                        return (
                            <div
                                key={person.name}
                                className={`bg-surface-container-lowest p-4 rounded-2xl shadow-xs border transition-all ${
                                    isCurrent
                                        ? 'border-primary/40 ring-1 ring-primary/20'
                                        : 'border-outline-variant/30'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Avatar name={person.name} size="lg" />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <h3 className="font-semibold text-sm text-on-surface truncate">
                                                    {person.name}
                                                </h3>
                                                {isCurrent && (
                                                    <span className="text-[10px] bg-primary text-on-primary font-bold px-1.5 py-0.2 rounded-full">
                                                        You
                                                    </span>
                                                )}
                                            </div>
                                            {person.upiId ? (
                                                <div className="flex items-center gap-1 text-xs text-on-surface-variant font-mono mt-0.5">
                                                    <span className="truncate">{person.upiId}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy(person.upiId!)}
                                                        className="text-primary hover:text-primary-container cursor-pointer ml-0.5"
                                                        title="Copy UPI"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">
                                                            content_copy
                                                        </span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-tertiary font-medium block mt-0.5">
                                                    No UPI ID linked
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {!isCurrent && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActivePerson(person.name);
                                                    showToast(`Now viewing as ${person.name}`);
                                                }}
                                                className="h-8 px-2.5 rounded-lg bg-surface-container-low text-on-surface text-xs font-semibold hover:bg-surface-container transition-colors cursor-pointer border border-outline-variant/20"
                                            >
                                                Switch To
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingPerson(person);
                                                setUpiInput(person.upiId || '');
                                            }}
                                            className="h-8 px-2.5 rounded-lg bg-surface-container text-primary hover:bg-primary hover:text-on-primary text-xs font-semibold transition-colors cursor-pointer border border-outline-variant/20"
                                        >
                                            {person.upiId ? 'Edit UPI' : '+ Add UPI'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Edit / Add UPI Modal */}
            {editingPerson && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
                    <div className="bg-surface-container-lowest rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-outline-variant/30 space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
                            <div>
                                <h3 className="font-bold text-base text-on-surface">
                                    {editingPerson.upiId ? 'Update' : 'Add'} UPI ID
                                </h3>
                                <p className="text-xs text-on-surface-variant">
                                    For {editingPerson.name}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingPerson(null)}
                                className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[16px]">
                                    close
                                </span>
                            </button>
                        </div>

                        <form onSubmit={handleSaveUpi} className="space-y-3.5">
                            <div>
                                <label className="text-xs font-semibold text-on-surface-variant block mb-1">
                                    UPI Address (VPA)
                                </label>
                                <input
                                    type="text"
                                    value={upiInput}
                                    onChange={(e) => setUpiInput(e.target.value)}
                                    placeholder="e.g. name@oksbi, phone@paytm"
                                    className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-sm font-mono font-semibold text-on-surface border border-outline-variant/30 focus:outline-none"
                                    required
                                />
                            </div>

                            <p className="text-[11px] text-on-surface-variant leading-relaxed">
                                Used automatically when participants generate 1-tap UPI payment intents for group settlements.
                            </p>

                            <div className="flex items-center gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingPerson(null)}
                                    className="flex-1 h-10 rounded-xl bg-surface-container text-on-surface-variant text-xs font-semibold cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={updateUpiMutation.isPending}
                                    className="flex-1 h-10 rounded-xl bg-primary text-on-primary text-xs font-semibold shadow-xs hover:bg-primary-container cursor-pointer"
                                >
                                    {updateUpiMutation.isPending ? 'Saving...' : 'Save UPI ID'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PeoplePage;
