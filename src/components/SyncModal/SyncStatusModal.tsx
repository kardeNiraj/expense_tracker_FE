import React, { useState } from 'react';
import { useOfflineSync } from '../../utils/useOfflineSync';
import { triggerHaptic } from '../../utils/haptics';
import type {
    AddExpensePayload,
    AddSplitPayload,
    AddContributionPayload,
    SettleParticipantPayload,
    UpdateUpiPayload,
} from '../../api/types';
import type { QueuedItem, QueuedGroup } from '../../utils/offlineQueue';

export interface SyncStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SyncStatusModal: React.FC<SyncStatusModalProps> = ({ isOpen, onClose }) => {
    const {
        isOnline,
        pendingCount,
        groups,
        hasBackoff,
        isSyncing,
        syncNow,
        retryGroup,
        discardGroup,
        clearQueue,
    } = useOfflineSync();

    const [discardConfirmGroup, setDiscardConfirmGroup] = useState<string | null>(null);
    const [clearQueueConfirm, setClearQueueConfirm] = useState<boolean>(false);

    if (!isOpen) return null;

    const formatMutationName = (item: QueuedItem): { title: string; subtitle: string; icon: string } => {
        switch (item.type) {
            case 'ADD_SPLIT': {
                const p = item.payload as AddSplitPayload;
                return {
                    title: `Create Split: ${p.description || 'Split'}`,
                    subtitle: `₹${p.amount} • Paid by ${p.paidBy} (${p.participants?.length || 0} people)`,
                    icon: 'call_split',
                };
            }
            case 'SETTLE_PARTICIPANT': {
                const p = item.payload as SettleParticipantPayload;
                return {
                    title: `Confirm Settlement: ${p.from} → ${p.to || 'Creditor'}`,
                    subtitle: `Status: Marked Settled${p.confirmedBy ? ` by ${p.confirmedBy}` : ''}`,
                    icon: 'done_all',
                };
            }
            case 'ADD_CONTRIBUTION': {
                const p = item.payload as AddContributionPayload;
                return {
                    title: `Contribution: ₹${p.amount} by ${p.person}`,
                    subtitle: 'Upfront payment added to split',
                    icon: 'payments',
                };
            }
            case 'ADD_EXPENSE': {
                const p = item.payload as AddExpensePayload;
                return {
                    title: `Personal Expense: ${p.description || 'Expense'}`,
                    subtitle: `₹${p.amount} • ${p.category} • ${p.payee}`,
                    icon: 'receipt_long',
                };
            }
            case 'UPDATE_UPI': {
                const p = item.payload as UpdateUpiPayload;
                return {
                    title: `Update UPI: ${p.name}`,
                    subtitle: `UPI ID: ${p.upiId}`,
                    icon: 'account_balance_wallet',
                };
            }
            default:
                return {
                    title: 'Offline Operation',
                    subtitle: '',
                    icon: 'sync',
                };
        }
    };

    const renderGroupBadge = (group: QueuedGroup) => {
        if (group.status === 'SYNCING') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                    <span className="material-symbols-outlined text-[13px] animate-spin">sync</span>
                    <span>Syncing...</span>
                </span>
            );
        }

        if (group.status === 'BACKOFF') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    <span className="material-symbols-outlined text-[13px] animate-pulse">timer</span>
                    <span>Retrying in {group.backoffSecondsRemaining}s</span>
                </span>
            );
        }

        if (group.status === 'FAILED') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-error/10 text-error border border-error/20">
                    <span className="material-symbols-outlined text-[13px]">error</span>
                    <span>Failed (Backoff)</span>
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-surface-container-high text-on-surface-variant border border-outline-variant/30">
                <span className="material-symbols-outlined text-[13px]">schedule</span>
                <span>Queued</span>
            </span>
        );
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-surface w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[88vh] flex flex-col shadow-2xl border border-outline-variant/30 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Mobile Drag Indicator */}
                <div className="w-12 h-1 bg-outline-variant/60 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-outline-variant/20 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-[20px]">
                                {!isOnline ? 'cloud_off' : isSyncing ? 'sync' : 'cloud_sync'}
                            </span>
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                                <span>Sync Operations</span>
                                {pendingCount > 0 && (
                                    <span className="px-2 py-0.2 rounded-full text-[10px] font-mono font-bold bg-primary-fixed text-on-primary-fixed">
                                        {pendingCount}
                                    </span>
                                )}
                            </h2>
                            <p className="text-[11px] text-on-surface-variant font-medium">
                                Real-time status & independent split queues
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic('light');
                            onClose();
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                        aria-label="Close"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Network / Sync Banner */}
                <div className="px-4 pt-3 pb-2 shrink-0">
                    {!isOnline ? (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
                            <span className="material-symbols-outlined text-[20px] text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                                cloud_off
                            </span>
                            <div className="text-xs">
                                <span className="font-bold text-amber-700 dark:text-amber-300">
                                    You are currently offline
                                </span>
                                <p className="text-amber-800/80 dark:text-amber-200/80 mt-0.5 leading-relaxed text-[11px]">
                                    Transactions are stored safely in local IndexedDB. They will automatically sync to Google Sheets as soon as internet connection is restored.
                                </p>
                            </div>
                        </div>
                    ) : isSyncing ? (
                        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-[20px] text-primary shrink-0 animate-spin">
                                sync
                            </span>
                            <div className="text-xs">
                                <span className="font-bold text-primary">
                                    Synchronizing with Google Sheets...
                                </span>
                                <p className="text-on-surface-variant text-[11px]">
                                    Independent split groups are syncing in parallel.
                                </p>
                            </div>
                        </div>
                    ) : pendingCount > 0 ? (
                        <div className="p-3 rounded-xl bg-surface-container-high border border-outline-variant/30 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs">
                                <span className="material-symbols-outlined text-[18px] text-primary">
                                    cloud_queue
                                </span>
                                <div>
                                    <span className="font-bold text-on-surface">
                                        {pendingCount} {pendingCount === 1 ? 'operation' : 'operations'} pending
                                    </span>
                                    <p className="text-[11px] text-on-surface-variant">
                                        {hasBackoff
                                            ? 'Some splits are backing off before auto-retrying.'
                                            : 'Ready to synchronize with cloud.'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => syncNow()}
                                className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                            >
                                Sync Now
                            </button>
                        </div>
                    ) : (
                        <div className="p-3 rounded-xl bg-primary-fixed/20 border border-primary/20 flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-[20px] text-primary shrink-0">
                                check_circle
                            </span>
                            <div className="text-xs">
                                <span className="font-bold text-primary">
                                    All transactions synchronized!
                                </span>
                                <p className="text-on-surface-variant text-[11px]">
                                    Your app is up to date with Google Sheets.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Scrollable Queue List */}
                <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 overscroll-contain">
                    {groups.length === 0 ? (
                        <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
                            <div className="w-14 h-14 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary/70 mb-3">
                                <span className="material-symbols-outlined text-[32px]">cloud_done</span>
                            </div>
                            <h3 className="text-sm font-bold text-on-surface">Zero Pending Sync Operations</h3>
                            <p className="text-xs text-on-surface-variant max-w-xs mt-1 leading-relaxed">
                                Any expense or split created while offline will appear here and sync automatically when internet returns.
                            </p>
                        </div>
                    ) : (
                        groups.map((group) => (
                            <div
                                key={group.groupId}
                                className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-3.5 space-y-3 transition-all"
                            >
                                {/* Group Header */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                                            <span className="material-symbols-outlined text-[18px]">
                                                {group.type === 'SPLIT'
                                                    ? 'call_split'
                                                    : group.type === 'EXPENSE'
                                                    ? 'receipt_long'
                                                    : 'account_balance_wallet'}
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="text-sm font-bold text-on-surface truncate">
                                                    {group.title}
                                                </h4>
                                                {group.amount !== undefined && (
                                                    <span className="text-xs font-mono font-bold text-primary">
                                                        ₹{group.amount.toLocaleString('en-IN')}
                                                    </span>
                                                )}
                                            </div>
                                            {group.splitId && (
                                                <p className="text-[10px] font-mono text-on-surface-variant truncate">
                                                    ID: {group.splitId}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="shrink-0">{renderGroupBadge(group)}</div>
                                </div>

                                {/* Last Error Message (if any) */}
                                {group.lastError && (
                                    <div className="p-2.5 rounded-xl bg-error/10 border border-error/20 text-[11px] text-error flex items-start gap-1.5">
                                        <span className="material-symbols-outlined text-[15px] shrink-0 mt-0.5">
                                            warning
                                        </span>
                                        <span className="break-all leading-tight font-mono">
                                            {group.lastError}
                                        </span>
                                    </div>
                                )}

                                {/* Ordered List of Operations in this group */}
                                <div className="space-y-1.5 pl-2 border-l-2 border-primary/20 pt-1">
                                    <div className="text-[10px] font-mono uppercase font-bold tracking-wider text-on-surface-variant/70 mb-1">
                                        Order of Operations (FIFO):
                                    </div>
                                    {group.items.map((item, idx) => {
                                        const details = formatMutationName(item);
                                        return (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface-container/60 border border-outline-variant/15 text-xs"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                                                        {idx + 1}
                                                    </span>
                                                    <span className="material-symbols-outlined text-[15px] text-primary/70 shrink-0">
                                                        {details.icon}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-on-surface truncate text-[11px]">
                                                            {details.title}
                                                        </div>
                                                        {details.subtitle && (
                                                            <div className="text-[10px] text-on-surface-variant truncate">
                                                                {details.subtitle}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="shrink-0 text-[10px] font-mono">
                                                    {item.status === 'SYNCING' ? (
                                                        <span className="text-primary font-bold">Syncing</span>
                                                    ) : item.retryCount > 0 ? (
                                                        <span className="text-amber-600 dark:text-amber-400">
                                                            Retried {item.retryCount}x
                                                        </span>
                                                    ) : (
                                                        <span className="text-on-surface-variant">Pending</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Group Action Buttons */}
                                <div className="flex items-center justify-between pt-1 border-t border-outline-variant/15 text-xs">
                                    {discardConfirmGroup === group.groupId ? (
                                        <div className="flex items-center gap-2 w-full justify-end">
                                            <span className="text-[11px] text-error font-medium">Discard this group?</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    discardGroup(group.groupId);
                                                    setDiscardConfirmGroup(null);
                                                }}
                                                className="px-2.5 py-1 rounded-md bg-error text-on-error text-xs font-bold cursor-pointer"
                                            >
                                                Yes, Discard
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDiscardConfirmGroup(null)}
                                                className="px-2.5 py-1 rounded-md bg-surface-container text-on-surface text-xs font-medium cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setDiscardConfirmGroup(group.groupId)}
                                                className="text-[11px] text-error/80 hover:text-error flex items-center gap-1 cursor-pointer transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">delete</span>
                                                <span>Discard</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => retryGroup(group.groupId)}
                                                disabled={isSyncing || !isOnline}
                                                className="px-3 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">refresh</span>
                                                <span>Retry Now</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-outline-variant/20 bg-surface flex flex-col gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                        {pendingCount > 0 && !clearQueueConfirm && (
                            <button
                                type="button"
                                onClick={() => setClearQueueConfirm(true)}
                                className="h-10 px-3 rounded-xl border border-error/30 text-error hover:bg-error/10 text-xs font-bold transition-colors cursor-pointer shrink-0"
                            >
                                Clear All
                            </button>
                        )}

                        {clearQueueConfirm && (
                            <div className="flex items-center gap-2 flex-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        clearQueue();
                                        setClearQueueConfirm(false);
                                    }}
                                    className="h-10 flex-1 rounded-xl bg-error text-on-error text-xs font-bold cursor-pointer"
                                >
                                    Confirm Clear
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setClearQueueConfirm(false)}
                                    className="h-10 px-3 rounded-xl bg-surface-container text-on-surface text-xs font-medium cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => syncNow()}
                            disabled={!isOnline || isSyncing || pendingCount === 0}
                            className="h-10 flex-1 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            <span className={`material-symbols-outlined text-[16px] ${isSyncing ? 'animate-spin' : ''}`}>
                                {!isOnline ? 'cloud_off' : isSyncing ? 'sync' : 'cloud_upload'}
                            </span>
                            <span>{isSyncing ? 'Syncing...' : 'Sync All Transactions'}</span>
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-2 rounded-xl text-on-surface-variant hover:text-on-surface text-xs font-semibold cursor-pointer text-center"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SyncStatusModal;

