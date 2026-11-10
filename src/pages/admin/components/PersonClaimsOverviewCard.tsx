import React, { useState } from 'react';
import { Avatar } from '../../../components/Avatar';
import { ENV } from '../../../config';
import type { AdminPersonStat, AdminUpdateDevicePayload } from '../../../api/types';

interface PersonClaimsOverviewCardProps {
    stats: AdminPersonStat[];
    currentDeviceId: string;
    busyPerson: string | null;
    busyDeviceId: string | null;
    onToggleLock: (person: string, locked: boolean) => void;
    onUpdateDevice: (deviceId: string, updates: AdminUpdateDevicePayload) => void;
}

export const PersonClaimsOverviewCard: React.FC<PersonClaimsOverviewCardProps> = ({
    stats,
    currentDeviceId,
    busyPerson,
    busyDeviceId,
    onToggleLock,
    onUpdateDevice,
}) => {
    const [expandedPerson, setExpandedPerson] = useState<string | null>(null);

    return (
        <section className="bg-surface-card border border-border-subtle rounded-3xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h2 className="headline-md text-on-surface text-base">
                        Identity Claims &amp; Strict Locks
                    </h2>
                    <p className="text-[11px] text-on-surface-variant">
                        Active devices per member ID. Lock IDs to block unrecognized phones.
                    </p>
                </div>
            </div>

            <div className="space-y-2.5">
                {stats.map((stat) => {
                    const isExpanded = expandedPerson === stat.person;
                    const isLockBusy = busyPerson === stat.person;

                    const badgeStyle = stat.isMultiDevice
                        ? 'bg-status-pending-bg text-status-pending-text'
                        : stat.activeDeviceCount > 0
                          ? 'bg-status-settled-bg text-status-settled-text'
                          : 'bg-surface-card-subtle text-on-surface-variant';

                    return (
                        <div
                            key={stat.person}
                            className={`rounded-2xl border p-3 space-y-2.5 transition-colors ${
                                stat.isMultiDevice
                                    ? 'bg-status-pending-bg/20 border-tertiary/40'
                                    : 'bg-surface-card-subtle/60 border-border-subtle'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setExpandedPerson(isExpanded ? null : stat.person)
                                    }
                                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                                >
                                    <Avatar name={stat.person} size="sm" />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-bold text-sm text-on-surface truncate">
                                                {stat.person}
                                            </span>
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono tabular-nums ${badgeStyle}`}
                                            >
                                                {stat.activeDeviceCount}{' '}
                                                {stat.activeDeviceCount === 1 ? 'device' : 'devices'}
                                            </span>
                                            {stat.isMultiDevice && (
                                                <span className="px-1.5 py-0.5 rounded-full bg-error-container text-negative text-[10px] font-bold">
                                                    Multi-device alert
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[11px] text-on-surface-variant font-mono tabular-nums block">
                                            Spend: {ENV.CURRENCY_SYMBOL}
                                            {Math.round(stat.trueSpend).toLocaleString('en-IN')}
                                            {stat.blockedForPersonCount > 0
                                                ? ` · ${stat.blockedForPersonCount} blocked`
                                                : ''}
                                        </span>
                                    </div>
                                </button>

                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        type="button"
                                        disabled={isLockBusy}
                                        onClick={() => onToggleLock(stat.person, !stat.isLocked)}
                                        className={`h-8 px-2.5 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50 ${
                                            stat.isLocked
                                                ? 'bg-primary text-on-primary'
                                                : 'bg-surface-card border border-border-strong text-on-surface-variant hover:text-on-surface'
                                        }`}
                                        title={
                                            stat.isLocked
                                                ? 'Unlock new claims for this person'
                                                : 'Lock new claims for this person'
                                        }
                                    >
                                        <span className="material-symbols-outlined text-[14px]">
                                            {stat.isLocked ? 'lock' : 'lock_open'}
                                        </span>
                                        <span>{stat.isLocked ? 'Locked' : 'Unlocked'}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setExpandedPerson(isExpanded ? null : stat.person)
                                        }
                                        className="w-8 h-8 rounded-xl bg-surface-card border border-border-subtle flex items-center justify-center text-on-surface-variant cursor-pointer"
                                        aria-label={`Inspect devices for ${stat.person}`}
                                    >
                                        <span className="material-symbols-outlined text-[18px]">
                                            {isExpanded ? 'expand_less' : 'expand_more'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="pt-2 border-t border-border-subtle space-y-2">
                                    {stat.devices.length === 0 ? (
                                        <p className="text-[11px] text-on-surface-variant px-1">
                                            No devices are currently claiming {stat.person}.
                                        </p>
                                    ) : (
                                        stat.devices.map((dev) => {
                                            const isSelf = dev.deviceId === currentDeviceId;
                                            const isDevBusy = busyDeviceId === dev.deviceId;
                                            const shortId = dev.deviceId.slice(-8);

                                            return (
                                                <div
                                                    key={dev.deviceId}
                                                    className="p-2.5 rounded-xl bg-surface-card border border-border-subtle flex items-center justify-between gap-2"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-xs font-bold text-on-surface truncate">
                                                                {dev.label || dev.platform || 'Device'}
                                                            </span>
                                                            <span className="text-[10px] font-mono text-on-surface-variant">
                                                                #{shortId}
                                                            </span>
                                                            {isSelf && (
                                                                <span className="px-1.5 py-0.5 rounded-full bg-status-settled-bg text-status-settled-text text-[9px] font-bold">
                                                                    THIS DEVICE
                                                                </span>
                                                            )}
                                                            {dev.status === 'BLOCKED' && (
                                                                <span className="px-1.5 py-0.5 rounded-full bg-error-container text-negative text-[9px] font-bold">
                                                                    BLOCKED
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] text-on-surface-variant block">
                                                            {dev.platform || 'Unknown OS'} · Seen{' '}
                                                            {dev.lastSeenAt || 'N/A'}
                                                        </span>
                                                    </div>

                                                    {!isSelf && (
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                type="button"
                                                                disabled={isDevBusy}
                                                                onClick={() =>
                                                                    onUpdateDevice(dev.deviceId, {
                                                                        revokeClaim: true,
                                                                    })
                                                                }
                                                                className="px-2 py-1 rounded-lg bg-surface-card-subtle text-[10px] font-semibold text-on-surface-variant hover:text-on-surface border border-border-subtle cursor-pointer disabled:opacity-50"
                                                            >
                                                                Revoke
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={isDevBusy}
                                                                onClick={() =>
                                                                    onUpdateDevice(dev.deviceId, {
                                                                        blockPerson: stat.person,
                                                                    })
                                                                }
                                                                className="px-2 py-1 rounded-lg bg-error-container text-negative text-[10px] font-bold cursor-pointer disabled:opacity-50"
                                                                title={`Block this device from using ${stat.person}'s ID`}
                                                            >
                                                                Block ID
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default PersonClaimsOverviewCard;

