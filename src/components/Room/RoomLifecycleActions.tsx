import React, { useState } from 'react';
import { useUpdateGroupStatusMutation } from '../../api/groupApi';
import type { GroupSummary } from '../../api/types';
import { useExpense } from '../../context';
import { AppIcon } from '../Icon/AppIcon';

export interface RoomLifecycleActionsProps {
    group: GroupSummary;
    onStatusUpdated?: (newStatus: 'ACTIVE' | 'ARCHIVED' | 'CLOSED') => void;
}

export const RoomLifecycleActions: React.FC<RoomLifecycleActionsProps> = ({
    group,
    onStatusUpdated,
}) => {
    const { showToast } = useExpense();
    const updateStatusMutation = useUpdateGroupStatusMutation();

    const [pendingAction, setPendingAction] = useState<'ARCHIVE' | 'REACTIVATE' | 'CLOSE' | null>(
        null
    );
    const [actionError, setActionError] = useState<string | null>(null);

    const roomStatus = (group.status || 'ACTIVE').toUpperCase();
    const isOwner = Boolean(group.isOwner);

    if (roomStatus === 'CLOSED') {
        return (
            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 text-xs flex items-start gap-3 shadow-xs">
                <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0 text-on-surface-variant">
                    <AppIcon name="lock" className="text-base" />
                </div>
                <div className="space-y-1">
                    <div className="font-semibold text-on-surface font-headline">Room is Permanently Closed</div>
                    <p className="leading-relaxed text-on-surface-variant">
                        This room was finalized and closed on{' '}
                        {group.closedAt ? new Date(group.closedAt).toLocaleDateString() : 'earlier'}.
                        All records are preserved permanently as read-only historical reference.
                    </p>
                </div>
            </div>
        );
    }

    if (!isOwner) {
        if (roomStatus === 'ARCHIVED') {
            return (
                <div className="rounded-2xl border border-tertiary/25 bg-tertiary/10 p-4 text-xs flex items-start gap-3 shadow-xs">
                    <div className="w-8 h-8 rounded-lg bg-tertiary/15 text-tertiary flex items-center justify-center shrink-0">
                        <AppIcon name="inventory_2" className="text-base" />
                    </div>
                    <div className="space-y-1">
                        <div className="font-bold text-tertiary font-headline">Room is Archived</div>
                        <p className="leading-relaxed text-on-surface-variant text-[11px]">
                            The room owner has archived this room. No new expenses can be added, but
                            you can still settle outstanding balances.
                        </p>
                    </div>
                </div>
            );
        }
        return null;
    }

    const handleConfirm = async () => {
        if (!pendingAction) return;
        setActionError(null);

        let targetStatus: 'ACTIVE' | 'ARCHIVED' | 'CLOSED';
        if (pendingAction === 'ARCHIVE') targetStatus = 'ARCHIVED';
        else if (pendingAction === 'REACTIVATE') targetStatus = 'ACTIVE';
        else targetStatus = 'CLOSED';

        try {
            await updateStatusMutation.mutateAsync({
                groupId: group.groupId,
                status: targetStatus,
            });

            const actionLabel =
                targetStatus === 'ARCHIVED'
                    ? 'archived'
                    : targetStatus === 'ACTIVE'
                      ? 'reactivated'
                      : 'closed';

            showToast(`Room successfully ${actionLabel}!`, 'check_circle');
            onStatusUpdated?.(targetStatus);
            setPendingAction(null);
        } catch (err: unknown) {
            const apiError = err as { message?: string; response?: { data?: { message?: string } } };
            const errorMsg =
                apiError?.response?.data?.message ||
                apiError?.message ||
                'Failed to update room status. Please try again.';
            setActionError(errorMsg);
        }
    };

    return (
        <div className="space-y-3">
            {roomStatus === 'ARCHIVED' && (
                <div className="rounded-2xl border border-tertiary/25 bg-tertiary/10 p-4 text-xs flex items-start gap-3 shadow-xs">
                    <div className="w-8 h-8 rounded-lg bg-tertiary/15 text-tertiary flex items-center justify-center shrink-0">
                        <AppIcon name="inventory_2" className="text-base" />
                    </div>
                    <div className="space-y-1">
                        <div className="font-bold text-tertiary font-headline">Room is Currently Archived</div>
                        <p className="leading-relaxed text-on-surface-variant text-[11px]">
                            New expenses are disabled. Existing debts can still be settled. You can
                            reactivate the room anytime or permanently close it once balances are
                            settled.
                        </p>
                    </div>
                </div>
            )}

            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-semibold text-on-surface font-headline">Room Lifecycle</h4>
                        <p className="text-xs text-on-surface-variant">
                            Manage the active, archived, or closed state of this room.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                    {roomStatus === 'ACTIVE' && (
                        <>
                            <button
                                type="button"
                                onClick={() => {
                                    setActionError(null);
                                    setPendingAction('ARCHIVE');
                                }}
                                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-tertiary/10 text-tertiary border border-tertiary/25 hover:bg-tertiary/15 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <AppIcon name="inventory_2" className="text-sm" />
                                Archive Room
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setActionError(null);
                                    setPendingAction('CLOSE');
                                }}
                                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/30 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <AppIcon name="lock" className="text-sm" />
                                Close Room
                            </button>
                        </>
                    )}

                    {roomStatus === 'ARCHIVED' && (
                        <>
                            <button
                                type="button"
                                onClick={() => {
                                    setActionError(null);
                                    setPendingAction('REACTIVATE');
                                }}
                                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <AppIcon name="refresh" className="text-sm" />
                                Reactivate Room
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setActionError(null);
                                    setPendingAction('CLOSE');
                                }}
                                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/30 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <AppIcon name="lock" className="text-sm" />
                                Close Room Permanently
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            {pendingAction && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
                    onClick={() => {
                        if (!updateStatusMutation.isPending) {
                            setPendingAction(null);
                            setActionError(null);
                        }
                    }}
                >
                    <div
                        className="w-full max-w-sm rounded-3xl bg-surface-container-lowest border border-outline-variant/30 p-5 space-y-4 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-3">
                            <div
                                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                                    pendingAction === 'ARCHIVE'
                                        ? 'bg-tertiary/15 text-tertiary'
                                        : pendingAction === 'REACTIVATE'
                                          ? 'bg-primary/10 text-primary'
                                          : 'bg-error-container text-on-error-container'
                                }`}
                            >
                                <AppIcon
                                    name={
                                        pendingAction === 'ARCHIVE'
                                            ? 'inventory_2'
                                            : pendingAction === 'REACTIVATE'
                                              ? 'refresh'
                                              : 'lock'
                                    }
                                    className="text-xl"
                                />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-base font-semibold text-on-surface font-headline">
                                    {pendingAction === 'ARCHIVE' && 'Archive Room?'}
                                    {pendingAction === 'REACTIVATE' && 'Reactivate Room?'}
                                    {pendingAction === 'CLOSE' && 'Permanently Close Room?'}
                                </h3>
                                <p className="text-xs text-on-surface-variant leading-relaxed">
                                    {pendingAction === 'ARCHIVE' &&
                                        'Archiving freezes the room against new expenses. Members will still be able to record payments and settle any outstanding balances.'}
                                    {pendingAction === 'REACTIVATE' &&
                                        'Reactivating restores full active functionality. Members will be able to add new expenses and manage the room normally.'}
                                    {pendingAction === 'CLOSE' &&
                                        'Closing is permanent and irreversible. All debts must already be settled. Once closed, the room becomes read-only forever.'}
                                </p>
                            </div>
                        </div>

                        {actionError && (
                            <div className="p-3 rounded-xl bg-error-container/60 border border-error/30 text-xs text-on-error-container flex items-start gap-2">
                                <AppIcon name="error" className="text-sm shrink-0 mt-0.5 text-error" />
                                <span className="font-medium">{actionError}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-2 pt-2">
                            <button
                                type="button"
                                disabled={updateStatusMutation.isPending}
                                onClick={() => {
                                    setPendingAction(null);
                                    setActionError(null);
                                }}
                                className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={updateStatusMutation.isPending}
                                onClick={handleConfirm}
                                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer ${
                                    pendingAction === 'ARCHIVE'
                                        ? 'bg-tertiary hover:bg-tertiary-dark text-on-primary shadow-xs'
                                        : pendingAction === 'REACTIVATE'
                                          ? 'bg-primary hover:bg-primary-dark text-on-primary shadow-xs'
                                          : 'bg-error hover:bg-error/90 text-on-error shadow-xs'
                                }`}
                            >
                                {updateStatusMutation.isPending ? (
                                    <>
                                        <AppIcon
                                            name="progress_activity"
                                            className="text-sm animate-spin"
                                        />
                                        <span>Updating...</span>
                                    </>
                                ) : (
                                    <span>
                                        {pendingAction === 'ARCHIVE' && 'Archive'}
                                        {pendingAction === 'REACTIVATE' && 'Reactivate'}
                                        {pendingAction === 'CLOSE' && 'Close Room'}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoomLifecycleActions;

