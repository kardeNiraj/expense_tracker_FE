import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    setBulkPersonLocksApi,
    setPersonLockApi,
    updateAdminDeviceApi,
    useAdminDashboard,
    usePeople,
} from '../../api';
import type { AdminUpdateDevicePayload } from '../../api';
import { useExpense } from '../../context';
import { triggerHaptic } from '../../utils/haptics';
import { AdminAccessGate } from './components/AdminAccessGate';
import { AdminHeroSummary } from './components/AdminHeroSummary';
import { AdminPushCard } from './components/AdminPushCard';
import { PendingApprovalsCard } from './components/PendingApprovalsCard';
import { RoomRegistryCard } from './components/RoomRegistryCard';
import { PersonClaimsOverviewCard } from './components/PersonClaimsOverviewCard';
import { DeviceRegistryCard } from './components/DeviceRegistryCard';
import { SecurityAuditCard } from './components/SecurityAuditCard';
import { AdminSkeleton, AppIcon } from '../../components';

export const AdminPage: React.FC = () => {
    const {
        isSwitcherUnlocked,
        currentDeviceId,
        lockSwitcher,
        refreshDeviceStatus,
        showToast,
    } = useExpense();
    const queryClient = useQueryClient();

    const [selectedScope, setSelectedScope] = useState<string>('ALL');

    const { data: people = [] } = usePeople(
        false,
        selectedScope === 'ALL' ? undefined : selectedScope
    );
    const {
        data: dashboard,
        isLoading,
        isFetching,
        isError,
        error,
        refetch,
    } = useAdminDashboard(isSwitcherUnlocked, false, selectedScope);

    const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null);
    const [busyPerson, setBusyPerson] = useState<string | null>(null);
    const [isBulkBusy, setIsBulkBusy] = useState(false);

    if (!isSwitcherUnlocked) {
        return <AdminAccessGate />;
    }

    const invalidateAdminAndDevice = async () => {
        await Promise.allSettled([
            queryClient.invalidateQueries({ queryKey: ['admin'] }),
            refreshDeviceStatus(),
        ]);
        await refetch();
    };

    const handleRefresh = async () => {
        triggerHaptic('light');
        await refetch();
        showToast('Admin telemetry refreshed', 'sync');
    };

    const handleUpdateDevice = async (
        deviceId: string,
        updates: AdminUpdateDevicePayload
    ) => {
        setBusyDeviceId(deviceId);
        try {
            await updateAdminDeviceApi(deviceId, updates);
            triggerHaptic('success');
            await invalidateAdminAndDevice();
            showToast('Device rule updated', 'verified_user');
        } catch (err) {
            triggerHaptic('warning');
            showToast(
                err instanceof Error ? err.message : 'Failed to update device',
                'error'
            );
        } finally {
            setBusyDeviceId(null);
        }
    };

    const handleToggleLock = async (person: string, locked: boolean) => {
        setBusyPerson(person);
        try {
            await setPersonLockApi(person, locked);
            triggerHaptic('medium');
            await invalidateAdminAndDevice();
            showToast(
                `${person}'s identity ${locked ? 'locked' : 'unlocked'}`,
                locked ? 'lock' : 'lock_open'
            );
        } catch (err) {
            triggerHaptic('warning');
            showToast(
                err instanceof Error ? err.message : 'Failed to update claim lock',
                'error'
            );
        } finally {
            setBusyPerson(null);
        }
    };

    const handleBulkLock = async (locked: boolean) => {
        setIsBulkBusy(true);
        try {
            await setBulkPersonLocksApi(locked, people);
            triggerHaptic('success');
            await invalidateAdminAndDevice();
            showToast(
                locked
                    ? 'All member identities locked for new devices'
                    : 'All member identities unlocked',
                locked ? 'lock' : 'lock_open'
            );
        } catch (err) {
            triggerHaptic('warning');
            showToast(
                err instanceof Error ? err.message : 'Failed to update bulk locks',
                'error'
            );
        } finally {
            setIsBulkBusy(false);
        }
    };

    const handleExitAdmin = () => {
        triggerHaptic('light');
        queryClient.removeQueries({ queryKey: ['admin'] });
        lockSwitcher();
        showToast('Exited Admin Console', 'lock');
    };

    if (isLoading && !dashboard) {
        return <AdminSkeleton />;
    }

    if (isError && !dashboard) {
        return (
            <div className="pt-4">
                <div className="bg-surface-card border border-negative/30 rounded-3xl p-6 text-center space-y-3">
                    <AppIcon name="gpp_maybe" className="text-negative text-[36px]" />
                    <h2 className="headline-md text-on-surface">
                        Could not load Admin Console
                    </h2>
                    <p className="text-xs text-on-surface-variant">
                        {error instanceof Error ? error.message : 'Unauthorized or network error'}
                    </p>
                    <div className="flex items-center justify-center gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => void refetch()}
                            className="h-10 px-4 rounded-xl bg-primary text-on-primary text-xs font-bold cursor-pointer"
                        >
                            Retry
                        </button>
                        <button
                            type="button"
                            onClick={handleExitAdmin}
                            className="h-10 px-4 rounded-xl bg-surface-card-subtle text-on-surface text-xs font-semibold cursor-pointer"
                        >
                            Exit Admin
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!dashboard) return null;

    const allKnownPeople = Array.from(
        new Set([...people, ...dashboard.personDeviceStats.map((s) => s.person)])
    );

    return (
        <div className="space-y-4 pb-6">
            <AdminHeroSummary
                summary={dashboard.summary}
                rooms={dashboard.rooms}
                selectedScope={selectedScope}
                onSelectScope={(scope) => {
                    triggerHaptic('selection');
                    setSelectedScope(scope);
                }}
                isBusy={isFetching || isBulkBusy}
                onRefresh={() => void handleRefresh()}
                onBulkLock={(locked) => void handleBulkLock(locked)}
                onExitAdmin={handleExitAdmin}
            />

            {/* High Priority: Pending Claim Approvals requiring admin attention */}
            <PendingApprovalsCard
                pendingApprovals={dashboard.pendingApprovals}
                busyDeviceId={busyDeviceId}
                onUpdateDevice={(id, updates) => void handleUpdateDevice(id, updates)}
            />

            {/* Room & Group Fleet Oversight */}
            {dashboard.rooms && dashboard.rooms.length > 0 && (
                <RoomRegistryCard
                    rooms={dashboard.rooms}
                    selectedGroupId={selectedScope}
                    onSelectRoom={(groupId) => {
                        triggerHaptic('selection');
                        setSelectedScope(groupId);
                    }}
                />
            )}

            <AdminPushCard />

            <PersonClaimsOverviewCard
                stats={dashboard.personDeviceStats}
                currentDeviceId={currentDeviceId}
                busyPerson={busyPerson}
                busyDeviceId={busyDeviceId}
                onToggleLock={(person, locked) => void handleToggleLock(person, locked)}
                onUpdateDevice={(id, updates) => void handleUpdateDevice(id, updates)}
            />

            <DeviceRegistryCard
                devices={dashboard.devices}
                personStats={dashboard.personDeviceStats}
                people={allKnownPeople}
                currentDeviceId={currentDeviceId}
                busyDeviceId={busyDeviceId}
                onUpdateDevice={(id, updates) => void handleUpdateDevice(id, updates)}
            />

            <SecurityAuditCard events={dashboard.recentEvents} />
        </div>
    );
};

export default AdminPage;

