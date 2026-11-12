import React, { useId, useMemo, useState } from 'react';
import type {
    AdminDeviceRecord,
    AdminPersonStat,
    AdminUpdateDevicePayload,
} from '../../../api/types';
import { DeviceRegistryItem } from './DeviceRegistryItem';
import { AppIcon } from '../../../components';

type DeviceFilter = 'all' | 'multi' | 'blocked' | 'unclaimed' | 'pending';

interface DeviceRegistryCardProps {
    devices: AdminDeviceRecord[];
    personStats: AdminPersonStat[];
    people: string[];
    currentDeviceId: string;
    busyDeviceId: string | null;
    onUpdateDevice: (deviceId: string, updates: AdminUpdateDevicePayload) => void;
}

export const DeviceRegistryCard: React.FC<DeviceRegistryCardProps> = ({
    devices,
    personStats,
    people,
    currentDeviceId,
    busyDeviceId,
    onUpdateDevice,
}) => {
    const [filter, setFilter] = useState<DeviceFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const searchId = useId();

    const multiDevicePeople = useMemo(() => {
        const set = new Set<string>();
        for (const stat of personStats) {
            if (stat.isMultiDevice) {
                set.add(stat.person.toLowerCase());
            }
        }
        return set;
    }, [personStats]);

    const filteredDevices = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return devices.filter((dev) => {
            if (filter === 'blocked' && dev.status !== 'BLOCKED') return false;
            if (filter === 'unclaimed' && dev.claimedPerson) return false;
            if (filter === 'pending' && !dev.pendingPerson) return false;
            if (
                filter === 'multi' &&
                (!dev.claimedPerson || !multiDevicePeople.has(dev.claimedPerson.toLowerCase()))
            ) {
                return false;
            }
            if (!q) return true;
            return (
                dev.deviceId.toLowerCase().includes(q) ||
                (dev.label || '').toLowerCase().includes(q) ||
                (dev.platform || '').toLowerCase().includes(q) ||
                (dev.claimedPerson || '').toLowerCase().includes(q) ||
                (dev.pendingPerson || '').toLowerCase().includes(q)
            );
        });
    }, [devices, filter, multiDevicePeople, searchQuery]);

    const filterChips: { id: DeviceFilter; label: string }[] = [
        { id: 'all', label: `All (${devices.length})` },
        { id: 'multi', label: 'Multi-Device' },
        { id: 'pending', label: 'Pending' },
        { id: 'blocked', label: 'Blocked' },
        { id: 'unclaimed', label: 'Unclaimed' },
    ];

    return (
        <section className="bg-surface-card border border-border-subtle rounded-3xl p-4 space-y-3">
            <div>
                <h2 className="headline-md text-on-surface text-base">
                    Registered Devices ({filteredDevices.length})
                </h2>
                <p className="text-[11px] text-on-surface-variant">
                    Block entire devices or restrict a device from specific member IDs.
                </p>
            </div>

            {/* Search Input */}
            <div>
                <label htmlFor={searchId} className="sr-only">
                    Search devices by name, label, platform, or ID
                </label>
                <div className="relative">
                    <AppIcon name="search" className="text-[18px] text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        id={searchId}
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search member, label, OS, or device ID..."
                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-card-subtle border border-border-subtle text-xs text-on-surface focus:border-primary focus:outline-none"
                    />
                </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {filterChips.map((chip) => {
                    const active = filter === chip.id;
                    return (
                        <button
                            key={chip.id}
                            type="button"
                            onClick={() => setFilter(chip.id)}
                            className={`h-8 px-3 rounded-full text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                                active
                                    ? 'bg-primary text-on-primary'
                                    : 'bg-surface-card-subtle text-on-surface-variant hover:text-on-surface border border-border-subtle'
                            }`}
                        >
                            {chip.label}
                        </button>
                    );
                })}
            </div>

            {/* Device Cards */}
            {filteredDevices.length === 0 ? (
                <div className="p-6 rounded-2xl bg-surface-card-subtle text-center text-xs text-on-surface-variant">
                    No devices match the active filter.
                </div>
            ) : (
                <div className="space-y-2.5">
                    {filteredDevices.map((dev) => (
                        <DeviceRegistryItem
                            key={dev.deviceId}
                            device={dev}
                            people={people}
                            isCurrentDevice={dev.deviceId === currentDeviceId}
                            isBusy={busyDeviceId === dev.deviceId}
                            onUpdateDevice={onUpdateDevice}
                        />
                    ))}
                </div>
            )}
        </section>
    );
};

export default DeviceRegistryCard;

