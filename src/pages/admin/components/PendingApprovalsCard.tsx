import React from 'react';
import type { AdminDeviceRecord, AdminUpdateDevicePayload } from '../../../api/types';
import { AppIcon } from '../../../components';

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
        <section className="bg-surface-card border-2 border-status-pending-text/40 rounded-3xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-status-pending-bg text-status-pending-text flex items-center justify-center">
                        <AppIcon name="approval_delegation" className="text-[18px]" />
                    </span>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="headline-md text-on-surface text-base">
                                Requires Attention: Device Approvals ({pendingApprovals.length})
                            </h2>
                            <span className="px-2 py-0.5 rounded-full bg-status-pending-bg text-status-pending-text text-[10px] font-bold uppercase animate-pulse">
                                Action Needed
                            </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant">
                            Unrecognized devices requesting access to claimed member profiles.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-2.5">
                {pendingApprovals.map((dev) => {
                    const isBusy = busyDeviceId === dev.deviceId;
                    const shortId = dev.deviceId.slice(-8);

                    return (
                        <div
                            key={dev.deviceId}
                            className="p-3.5 rounded-2xl bg-status-pending-bg/25 border border-status-pending-text/25 space-y-3"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-sm text-on-surface">
                                            Wants Identity: {dev.pendingPerson}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full bg-surface-card text-on-surface-variant text-[10px] font-bold font-mono border border-border-subtle">
                                            #{shortId}
                                        </span>
                                        {dev.pendingGroupName && (
                                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                                                Room: {dev.pendingGroupName}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[11px] text-on-surface-variant block mt-0.5">
                                        {dev.platform || 'Unknown OS'} · Requested: {dev.lastSeenAt || 'recently'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                        onUpdateDevice(dev.deviceId, { approvePending: true })
                                    }
                                    className="flex-1 min-w-[130px] h-9 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-dark cursor-pointer transition-colors disabled:opacity-50"
                                >
                                    Approve {dev.pendingPerson}
                                </button>
                                <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                        onUpdateDevice(dev.deviceId, { rejectPending: true })
                                    }
                                    className="h-9 px-3.5 rounded-xl bg-surface-card text-on-surface-variant hover:text-on-surface text-xs font-semibold border border-border-subtle cursor-pointer transition-colors disabled:opacity-50"
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
                                    className="h-9 px-3.5 rounded-xl bg-error-container text-negative text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
                                >
                                    Block Device
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

