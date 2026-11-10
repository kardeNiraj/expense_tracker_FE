import React from 'react';
import type { AdminDeviceRecord, AdminUpdateDevicePayload } from '../../../api/types';

interface PendingApprovalsCardProps {
    pendingApprovals: AdminDeviceRecord[];
    busyDeviceId: string | null;
    onUpdateDevice: (deviceId: string, updates: AdminUpdateDevicePayload) => void;
}

export const PendingApprovalsCard: React.FC<PendingApprovalsCardProps> = ({
    pendingApprovals,
    busyDeviceId,
    onUpdateDevice,
}) => {
    if (pendingApprovals.length === 0) return null;

    return (
        <section className="bg-surface-card border border-status-awaiting-text/30 rounded-3xl p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-status-awaiting-text text-[20px]">
                        approval_delegation
                    </span>
                    <h2 className="headline-md text-on-surface text-base">
                        Pending Claim Approvals ({pendingApprovals.length})
                    </h2>
                </div>
            </div>

            <div className="space-y-2.5">
                {pendingApprovals.map((dev) => {
                    const isBusy = busyDeviceId === dev.deviceId;
                    const shortId = dev.deviceId.slice(-8);

                    return (
                        <div
                            key={dev.deviceId}
                            className="p-3.5 rounded-2xl bg-status-awaiting-bg/40 border border-border-subtle space-y-2.5"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-sm text-on-surface">
                                            Wants ID: {dev.pendingPerson}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full bg-status-awaiting-bg text-status-awaiting-text text-[10px] font-bold font-mono">
                                            #{shortId}
                                        </span>
                                    </div>
                                    <span className="text-[11px] text-on-surface-variant block mt-0.5">
                                        {dev.platform || 'Unknown OS'} · Seen {dev.lastSeenAt || 'just now'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                        onUpdateDevice(dev.deviceId, { approvePending: true })
                                    }
                                    className="flex-1 h-9 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-dark cursor-pointer transition-colors disabled:opacity-50"
                                >
                                    Approve {dev.pendingPerson}
                                </button>
                                <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                        onUpdateDevice(dev.deviceId, { rejectPending: true })
                                    }
                                    className="h-9 px-3 rounded-xl bg-surface-card text-on-surface-variant hover:text-on-surface text-xs font-semibold border border-border-subtle cursor-pointer transition-colors disabled:opacity-50"
                                >
                                    Reject
                                </button>
                                <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                        onUpdateDevice(dev.deviceId, {
                                            status: 'BLOCKED',
                                            rejectPending: true,
                                        })
                                    }
                                    className="h-9 px-3 rounded-xl bg-error-container text-negative text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
                                >
                                    Block
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default PendingApprovalsCard;

