import React, { useMemo } from 'react';
import type { AdminRecentEvent } from '../../../api/types';

interface SecurityAuditCardProps {
    events: AdminRecentEvent[];
}

function getActionBadgeClass(action: string): string {
    const upper = action.toUpperCase();
    if (upper.includes('BLOCKED') || upper.includes('REJECTED') || upper.includes('REVOKED')) {
        return 'bg-error-container text-negative';
    }
    if (upper.includes('REQUESTED') || upper.includes('UNCLAIMED')) {
        return 'bg-status-pending-bg text-status-pending-text';
    }
    if (upper.includes('APPROVED') || upper.includes('CLAIMED') || upper.includes('UNBLOCKED')) {
        return 'bg-status-settled-bg text-status-settled-text';
    }
    return 'bg-status-awaiting-bg text-status-awaiting-text';
}

export const SecurityAuditCard: React.FC<SecurityAuditCardProps> = ({ events }) => {
    const keyedEvents = useMemo(() => {
        const seen = new Map<string, number>();
        return events.map((ev) => {
            const baseKey =
                ev.id || `${ev.deviceId}-${ev.at}-${ev.action}-${ev.person || 'none'}`;
            const count = (seen.get(baseKey) || 0) + 1;
            seen.set(baseKey, count);
            const rowKey = count === 1 ? baseKey : `${baseKey}#${count}`;
            return { rowKey, ev };
        });
    }, [events]);

    return (
        <section className="bg-surface-card border border-border-subtle rounded-3xl p-4 space-y-3">
            <div>
                <h2 className="headline-md text-on-surface text-base">
                    Security &amp; Claim Audit Log
                </h2>
                <p className="text-[11px] text-on-surface-variant">
                    Recent identity claims, approvals, and block actions
                </p>
            </div>

            {keyedEvents.length === 0 ? (
                <p className="text-xs text-on-surface-variant py-4 text-center">
                    No security audit events recorded yet.
                </p>
            ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                    {keyedEvents.map(({ rowKey, ev }) => (
                        <div
                            key={rowKey}
                            className="p-2.5 rounded-2xl bg-surface-card-subtle/70 border border-border-subtle flex items-center justify-between gap-2"
                        >
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${getActionBadgeClass(
                                            ev.action
                                        )}`}
                                    >
                                        {ev.action}
                                    </span>
                                    {ev.person && (
                                        <span className="text-xs font-bold text-on-surface">
                                            {ev.person}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[11px] text-on-surface-variant block mt-0.5 truncate">
                                    {ev.label || ev.platform || 'Device'} (#{ev.deviceId.slice(-6)}) · by {ev.by}
                                </span>
                            </div>

                            <span className="text-[10px] font-mono text-on-surface-variant shrink-0">
                                {ev.at}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};

export default SecurityAuditCard;
