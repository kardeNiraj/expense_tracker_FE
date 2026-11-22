import React, { useId, useState } from 'react';
import type { AdminDeviceRecord, AdminUpdateDevicePayload } from '../../../api/types';
import { AppIcon } from '../../../components';

interface DeviceActionsFooterProps {
    device: AdminDeviceRecord;
    people: string[];
    isCurrentDevice: boolean;
    isBusy: boolean;
    onUpdateDevice: (deviceId: string, updates: AdminUpdateDevicePayload) => void;
}

export const DeviceActionsFooter: React.FC<DeviceActionsFooterProps> = ({
    device,
    people,
    isCurrentDevice,
    isBusy,
    onUpdateDevice,
}) => {
    const [selectedPerson, setSelectedPerson] = useState('');
    const targetSelectId = useId();

    const hasValidSelection = Boolean(selectedPerson && people.includes(selectedPerson));
    const targetPerson =
        (hasValidSelection ? selectedPerson : '') || device.claimedPerson || people[0] || '';
    const isBlocked = device.status === 'BLOCKED';

    return (
        <div className="pt-2.5 border-t border-border-subtle/80 space-y-2">
            {/* Identity Assignment Row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                <div className="relative flex-1 min-w-0">
                    <label htmlFor={targetSelectId} className="sr-only">
                        Select person for device action
                    </label>
                    <select
                        id={targetSelectId}
                        value={targetPerson}
                        onChange={(e) => setSelectedPerson(e.target.value)}
                        className="w-full h-8.5 pl-2.5 pr-7 rounded-xl bg-surface-card border border-border-strong text-xs text-on-surface focus:outline-none appearance-none cursor-pointer truncate"
                    >
                        {people.map((p) => (
                            <option key={p} value={p}>
                                {p}
                            </option>
                        ))}
                    </select>
                    <AppIcon
                        name="expand_more"
                        className="text-[16px] text-on-surface-variant absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        type="button"
                        disabled={isBusy || !targetPerson}
                        onClick={() => onUpdateDevice(device.deviceId, { claimedPerson: targetPerson })}
                        className="flex-1 sm:flex-none h-8.5 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
                        title="Assign device ownership to selected person"
                    >
                        <AppIcon name="person_add" className="text-[14px]" />
                        <span>Assign</span>
                    </button>
                    {!isCurrentDevice && (
                        <button
                            type="button"
                            disabled={isBusy || !targetPerson}
                            onClick={() => onUpdateDevice(device.deviceId, { blockPerson: targetPerson })}
                            className="flex-1 sm:flex-none h-8.5 px-2.5 rounded-xl bg-status-pending-bg hover:bg-status-pending-bg/80 text-status-pending-text text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
                            title="Block this device ONLY from using the selected person's ID"
                        >
                            <AppIcon name="lock" className="text-[13px]" />
                            <span>Block ID</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Device-Level Rules (Revoke Claim & Block/Unblock Device) */}
            {!isCurrentDevice && (
                <div className="flex items-center gap-1.5 pt-0.5">
                    {device.claimedPerson && (
                        <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onUpdateDevice(device.deviceId, { revokeClaim: true })}
                            className="flex-1 h-8 rounded-xl bg-surface-card hover:bg-surface-card-subtle border border-border-subtle text-on-surface-variant hover:text-on-surface text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                            <AppIcon name="link_off" className="text-[14px]" />
                            <span>Revoke Claim</span>
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                            onUpdateDevice(device.deviceId, {
                                status: isBlocked ? 'ACTIVE' : 'BLOCKED',
                            })
                        }
                        className={`flex-1 h-8 px-3 rounded-xl text-xs font-bold cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-1 ${
                            isBlocked
                                ? 'bg-status-settled-bg text-status-settled-text hover:bg-status-settled-bg/80'
                                : 'bg-error-container text-negative hover:bg-error-container/80'
                        }`}
                    >
                        <AppIcon name={isBlocked ? 'check_circle' : 'block'} className="text-[14px]" />
                        <span>{isBlocked ? 'Unblock Device' : 'Block Entire Device'}</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default DeviceActionsFooter;
