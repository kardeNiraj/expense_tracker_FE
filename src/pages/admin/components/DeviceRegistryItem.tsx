import React, { useState } from 'react';
import type { AdminDeviceRecord, AdminUpdateDevicePayload } from '../../../api/types';
import { DeviceLabelEditor } from './DeviceLabelEditor';
import { DeviceActionsFooter } from './DeviceActionsFooter';
import { AppIcon } from '../../../components';

interface DeviceRegistryItemProps {
    device: AdminDeviceRecord;
    people: string[];
    isCurrentDevice: boolean;
    isBusy: boolean;
    onUpdateDevice: (deviceId: string, updates: AdminUpdateDevicePayload) => void;
}

export const DeviceRegistryItem: React.FC<DeviceRegistryItemProps> = ({
    device,
    people,
    isCurrentDevice,
    isBusy,
    onUpdateDevice,
}) => {
    const [isEditingLabel, setIsEditingLabel] = useState(false);

    const isBlocked = device.status === 'BLOCKED';
    const shortId = device.deviceId.slice(-10);

    const handleSaveLabel = (nextLabel: string) => {
        onUpdateDevice(device.deviceId, { label: nextLabel });
        setIsEditingLabel(false);
    };

    return (
        <div
            className={`rounded-2xl border p-3.5 space-y-3 transition-colors ${
                isBlocked
                    ? 'bg-error-container/25 border-negative/30'
                    : 'bg-surface-card-subtle/60 border-border-subtle'
            }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-on-surface truncate">
                            {device.label || device.platform || 'Unlabeled Device'}
                        </span>
                        {isCurrentDevice && (
                            <span className="px-2 py-0.5 rounded-full bg-status-settled-bg text-status-settled-text text-[10px] font-bold">
                                THIS DEVICE
                            </span>
                        )}
                        <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isBlocked
                                    ? 'bg-error-container text-negative'
                                    : 'bg-surface-card text-on-surface-variant border border-border-subtle'
                            }`}
                        >
                            {device.status}
                        </span>
                    </div>

                    <div className="text-[11px] text-on-surface-variant mt-0.5 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span>{device.platform || 'Unknown OS'}</span>
                            <span className="font-mono text-[10px]" title={device.deviceId}>
                                ID: #{shortId}
                            </span>
                        </div>
                        <div className="font-mono text-[10px]">
                            First: {device.firstSeenAt || '—'} · Last: {device.lastSeenAt || '—'} · Claims: {device.claimCount}
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setIsEditingLabel((prev) => !prev)}
                    className="px-2 py-1 rounded-lg bg-surface-card border border-border-subtle text-[11px] font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer shrink-0"
                >
                    {isEditingLabel ? 'Cancel' : 'Label'}
                </button>
            </div>

            {isEditingLabel && (
                <DeviceLabelEditor
                    initialLabel={device.label || ''}
                    isBusy={isBusy}
                    onSave={handleSaveLabel}
                />
            )}

            <div className="flex items-center gap-1.5 flex-wrap">
                {device.claimedPerson ? (
                    <span className="px-2.5 py-1 rounded-xl bg-primary/10 text-primary text-[11px] font-bold">
                        Claimed: {device.claimedPerson}
                    </span>
                ) : (
                    <span className="px-2.5 py-1 rounded-xl bg-surface-card text-on-surface-variant border border-border-subtle text-[11px] font-medium">
                        Unclaimed
                    </span>
                )}

                {device.blockedPeople.map((blockedPerson) => (
                    <button
                        key={blockedPerson}
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                            onUpdateDevice(device.deviceId, { unblockPerson: blockedPerson })
                        }
                        className="px-2 py-1 rounded-xl bg-error-container text-negative text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title={`Click to unblock ${blockedPerson} on this device`}
                    >
                        <span>Blocked: {blockedPerson}</span>
                        <AppIcon name="close" className="text-[13px]" />
                    </button>
                ))}
            </div>

            <DeviceActionsFooter
                device={device}
                people={people}
                isCurrentDevice={isCurrentDevice}
                isBusy={isBusy}
                onUpdateDevice={onUpdateDevice}
            />
        </div>
    );
};

export default DeviceRegistryItem;
