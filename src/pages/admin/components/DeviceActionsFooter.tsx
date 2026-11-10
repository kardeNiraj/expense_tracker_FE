import React, { useId, useState } from 'react';
import type { AdminDeviceRecord, AdminUpdateDevicePayload } from '../../../api/types';

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
        <div className="pt-2 border-t border-border-subtle flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-[170px]">
                <label htmlFor={targetSelectId} className="sr-only">
                    Select person for device action
                </label>
                <select
                    id={targetSelectId}
                    value={targetPerson}
                    onChange={(e) => setSelectedPerson(e.target.value)}
                    className="h-8 px-2 rounded-xl bg-surface-card border border-border-strong text-xs text-on-surface flex-1 focus:outline-none"
                >
                    {people.map((p) => (
                        <option key={p} value={p}>
                            {p}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    disabled={isBusy || !targetPerson}
                    onClick={() => onUpdateDevice(device.deviceId, { claimedPerson: targetPerson })}
                    className="h-8 px-2.5 rounded-xl bg-surface-card border border-border-subtle text-primary text-[11px] font-bold hover:bg-primary/10 cursor-pointer disabled:opacity-50"
                    title="Assign device ownership to selected person"
                >
                    Assign
                </button>
                {!isCurrentDevice && (
                    <button
                        type="button"
                        disabled={isBusy || !targetPerson}
                        onClick={() => onUpdateDevice(device.deviceId, { blockPerson: targetPerson })}
                        className="h-8 px-2.5 rounded-xl bg-status-pending-bg text-status-pending-text text-[11px] font-bold cursor-pointer disabled:opacity-50"
                        title="Block this device ONLY from using the selected person's ID"
                    >
                        Block ID
                    </button>
                )}
            </div>

            {!isCurrentDevice && device.claimedPerson && (
                <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onUpdateDevice(device.deviceId, { revokeClaim: true })}
                    className="h-8 px-2.5 rounded-xl bg-surface-card border border-border-subtle text-on-surface-variant hover:text-on-surface text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                >
                    Revoke
                </button>
            )}

            {!isCurrentDevice && (
                <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                        onUpdateDevice(device.deviceId, {
                            status: isBlocked ? 'ACTIVE' : 'BLOCKED',
                        })
                    }
                    className={`h-8 px-3 rounded-xl text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-50 ${
                        isBlocked
                            ? 'bg-status-settled-bg text-status-settled-text'
                            : 'bg-error-container text-negative'
                    }`}
                >
                    {isBlocked ? 'Unblock Device' : 'Block Device'}
                </button>
            )}
        </div>
    );
};

export default DeviceActionsFooter;
