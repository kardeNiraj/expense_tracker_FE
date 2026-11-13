import React, { useId, useMemo, useState } from 'react';
import type { AdminRoomSummary } from '../../../api/types';
import { AppIcon } from '../../../components';
import { formatCurrency } from '../../../utils/formatters';

interface RoomRegistryCardProps {
    rooms: AdminRoomSummary[];
    selectedGroupId: string;
    onSelectRoom: (groupId: string) => void;
}

type RoomStatusFilter = 'all' | 'ACTIVE' | 'ARCHIVED' | 'CLOSED';

export const RoomRegistryCard: React.FC<RoomRegistryCardProps> = ({
    rooms,
    selectedGroupId,
    onSelectRoom,
}) => {
    const [statusFilter, setStatusFilter] = useState<RoomStatusFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const searchId = useId();

    const filteredRooms = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return rooms.filter((r) => {
            if (statusFilter !== 'all' && r.status !== statusFilter) return false;
            if (!q) return true;
            return (
                r.name.toLowerCase().includes(q) ||
                (r.subtitle || '').toLowerCase().includes(q) ||
                r.createdByName.toLowerCase().includes(q) ||
                r.groupId.toLowerCase().includes(q)
            );
        });
    }, [rooms, statusFilter, searchQuery]);

    const filterChips: { id: RoomStatusFilter; label: string }[] = [
        { id: 'all', label: `All (${rooms.length})` },
        { id: 'ACTIVE', label: 'Active' },
        { id: 'ARCHIVED', label: 'Archived' },
        { id: 'CLOSED', label: 'Closed' },
    ];

    return (
        <section className="bg-surface-card border border-border-subtle rounded-3xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h2 className="headline-md text-on-surface text-base">
                        Room & Group Fleet ({rooms.length})
                    </h2>
                    <p className="text-[11px] text-on-surface-variant">
                        Platform-wide group directory, member rosters, and settlement health.
                    </p>
                </div>
                {selectedGroupId !== 'ALL' && (
                    <button
                        type="button"
                        onClick={() => onSelectRoom('ALL')}
                        className="px-2.5 py-1 rounded-xl bg-primary/10 text-primary text-[11px] font-bold cursor-pointer hover:bg-primary/20 transition-colors"
                    >
                        Reset to Global View
                    </button>
                )}
            </div>

            {/* Search Input */}
            <div>
                <label htmlFor={searchId} className="sr-only">
                    Search rooms by name, owner, or group ID
                </label>
                <div className="relative">
                    <AppIcon
                        name="search"
                        className="text-[18px] text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                    <input
                        id={searchId}
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search room name, owner, or group ID..."
                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-card-subtle border border-border-subtle text-xs text-on-surface focus:border-primary focus:outline-none"
                    />
                </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {filterChips.map((chip) => {
                    const active = statusFilter === chip.id;
                    return (
                        <button
                            key={chip.id}
                            type="button"
                            onClick={() => setStatusFilter(chip.id)}
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

            {/* Room List */}
            {filteredRooms.length === 0 ? (
                <div className="p-6 rounded-2xl bg-surface-card-subtle text-center text-xs text-on-surface-variant">
                    No rooms match the active filter.
                </div>
            ) : (
                <div className="space-y-2.5">
                    {filteredRooms.map((room) => {
                        const isSelected = selectedGroupId === room.groupId;
                        const statusBadge =
                            room.status === 'ACTIVE'
                                ? 'bg-status-settled-bg text-status-settled-text'
                                : room.status === 'ARCHIVED'
                                ? 'bg-status-pending-bg text-status-pending-text'
                                : 'bg-surface-card-subtle text-on-surface-variant border border-border-subtle';

                        return (
                            <div
                                key={room.groupId}
                                className={`rounded-2xl border p-3.5 space-y-2.5 transition-all ${
                                    isSelected
                                        ? 'bg-primary/5 border-primary shadow-xs'
                                        : 'bg-surface-card-subtle/50 border-border-subtle hover:border-primary/30'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                        <span className="w-9 h-9 rounded-xl bg-surface-card border border-border-subtle flex items-center justify-center text-primary shrink-0">
                                            <AppIcon name={room.icon || 'groups'} className="text-[20px]" />
                                        </span>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h3 className="font-bold text-sm text-on-surface truncate">
                                                    {room.name}
                                                </h3>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge}`}>
                                                    {room.status}
                                                </span>
                                                {isSelected && (
                                                    <span className="px-2 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-bold">
                                                        ACTIVE SCOPE
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-on-surface-variant mt-0.5">
                                                Owner: <strong className="text-on-surface">{room.createdByName}</strong>
                                                {room.createdAt && ` · Created ${room.createdAt.slice(0, 10)}`}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => onSelectRoom(isSelected ? 'ALL' : room.groupId)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0 ${
                                            isSelected
                                                ? 'bg-surface-card border border-border-subtle text-on-surface-variant hover:text-on-surface'
                                                : 'bg-primary text-on-primary hover:bg-primary-dark'
                                        }`}
                                    >
                                        {isSelected ? 'View All' : 'Inspect'}
                                    </button>
                                </div>

                                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border-subtle/70 text-center">
                                    <div className="p-2 rounded-xl bg-surface-card border border-border-subtle/60">
                                        <span className="text-[10px] text-on-surface-variant block uppercase font-medium">
                                            Members
                                        </span>
                                        <span className="text-xs font-bold text-on-surface font-mono">
                                            {room.claimedMemberCount}/{room.memberCount}
                                        </span>
                                    </div>
                                    <div className="p-2 rounded-xl bg-surface-card border border-border-subtle/60">
                                        <span className="text-[10px] text-on-surface-variant block uppercase font-medium">
                                            Spend
                                        </span>
                                        <span className="text-xs font-bold text-on-surface font-mono">
                                            {formatCurrency(room.totalSpend)}
                                        </span>
                                    </div>
                                    <div className="p-2 rounded-xl bg-surface-card border border-border-subtle/60">
                                        <span className="text-[10px] text-on-surface-variant block uppercase font-medium">
                                            In-Flight Debt
                                        </span>
                                        <span className={`text-xs font-bold font-mono ${room.pendingSettlementsAmount > 0 ? 'text-status-pending-text' : 'text-on-surface'}`}>
                                            {formatCurrency(room.pendingSettlementsAmount)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

export default RoomRegistryCard;

