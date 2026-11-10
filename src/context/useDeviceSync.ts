import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { ClaimActionResult } from './ExpenseContextDef';
import { ApiError } from '../api/client';
import {
    claimDeviceApi,
    heartbeatDeviceApi,
    requestClaimApprovalApi,
    unclaimDeviceApi,
    verifyAdminTokenApi,
} from '../api/deviceApi';
import type { DeviceStateResponse } from '../api/types';
import {
    getActiveAdminToken,
    getDeviceIdSync,
    subscribeToAccessErrors,
    syncPersistentDeviceId,
} from '../utils/deviceIdentity';

interface DeviceTransition {
    blocked: boolean;
    reason: string | null;
    action: 'none' | 'apply' | 'clear';
    claimName?: string;
    toast?: { message: string; icon: string };
}

function resolveDeviceTransition(
    serverState: DeviceStateResponse,
    localClaimedPerson: string | null,
    hasAdmin: boolean
): DeviceTransition {
    if (serverState.status === 'BLOCKED') {
        return {
            blocked: true,
            reason: 'This device has been blocked by the group admin.',
            action: 'none',
        };
    }

    const conflict = serverState.claimSyncConflict;
    if (
        conflict === 'PERSON_ACCESS_BLOCKED' ||
        conflict === 'CLAIM_LOCKED' ||
        conflict === 'CLAIM_REVOKED'
    ) {
        const message =
            conflict === 'PERSON_ACCESS_BLOCKED'
                ? 'Access to this profile was restricted on this device by admin.'
                : 'Device profile claim requires admin approval.';
        return {
            blocked: false,
            reason: null,
            action: 'clear',
            toast: { message, icon: 'gpp_maybe' },
        };
    }

    if (conflict === 'CLAIM_REASSIGNED' && serverState.claimedPerson) {
        return {
            blocked: false,
            reason: null,
            action: 'apply',
            claimName: serverState.claimedPerson,
        };
    }

    if (serverState.claimedPerson) {
        const differs =
            !localClaimedPerson ||
            localClaimedPerson.toLowerCase() !== serverState.claimedPerson.toLowerCase();
        if (differs) {
            return {
                blocked: false,
                reason: null,
                action: 'apply',
                claimName: serverState.claimedPerson,
                toast:
                    localClaimedPerson === null && !hasAdmin
                        ? {
                              message: `Device approved & claimed as ${serverState.claimedPerson}!`,
                              icon: 'verified_user',
                          }
                        : undefined,
            };
        }
        return { blocked: false, reason: null, action: 'none' };
    }

    if (serverState.exists && localClaimedPerson && !hasAdmin) {
        return {
            blocked: false,
            reason: null,
            action: 'clear',
            toast: { message: 'Device profile claim was released by admin.', icon: 'lock_reset' },
        };
    }

    return { blocked: false, reason: null, action: 'none' };
}

function toClaimErrorResult(err: unknown, fallbackMessage: string): ClaimActionResult {
    if (err instanceof ApiError) {
        return { ok: false, code: err.code, message: err.message };
    }
    return { ok: false, code: 'NETWORK_ERROR', message: fallbackMessage };
}

interface UseDeviceSyncParams {
    claimedPersonRef: RefObject<string | null>;
    activePersonRef: RefObject<string>;
    applyLocalClaim: (name: string) => void;
    clearLocalClaim: () => void;
    onAdminSessionInvalid: () => void;
    showToast: (message: string, icon?: string) => void;
}

export function useDeviceSync({
    claimedPersonRef,
    activePersonRef,
    applyLocalClaim,
    clearLocalClaim,
    onAdminSessionInvalid,
    showToast,
}: UseDeviceSyncParams) {
    const [currentDeviceId, setCurrentDeviceId] = useState<string>(() => getDeviceIdSync());
    const [deviceState, setDeviceState] = useState<DeviceStateResponse | null>(null);
    const [isDeviceBlocked, setIsDeviceBlocked] = useState<boolean>(false);
    const [accessRestrictionReason, setAccessRestrictionReason] = useState<string | null>(null);
    const refreshInFlightRef = useRef(false);

    const applyServerDeviceState = useCallback(
        (serverState: DeviceStateResponse) => {
            setDeviceState(serverState);
            const transition = resolveDeviceTransition(
                serverState,
                claimedPersonRef.current,
                Boolean(getActiveAdminToken())
            );
            setIsDeviceBlocked(transition.blocked);
            setAccessRestrictionReason(transition.reason);

            if (transition.action === 'clear') clearLocalClaim();
            if (transition.action === 'apply' && transition.claimName) {
                applyLocalClaim(transition.claimName);
            }
            if (transition.toast) showToast(transition.toast.message, transition.toast.icon);
        },
        [applyLocalClaim, claimedPersonRef, clearLocalClaim, showToast]
    );

    const refreshDeviceStatus = useCallback(async () => {
        if (refreshInFlightRef.current) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;

        refreshInFlightRef.current = true;
        try {
            const state = await heartbeatDeviceApi({
                claimedPerson: claimedPersonRef.current,
                activePerson: activePersonRef.current,
            });
            applyServerDeviceState(state);
        } catch {
            // Ignore transient offline or network errors during background heartbeat
        } finally {
            refreshInFlightRef.current = false;
        }
    }, [activePersonRef, applyServerDeviceState, claimedPersonRef]);

    useEffect(() => {
        let mounted = true;
        const init = async () => {
            const resolvedId = await syncPersistentDeviceId();
            if (!mounted) return;
            setCurrentDeviceId(resolvedId);

            if (getActiveAdminToken()) {
                try {
                    await verifyAdminTokenApi();
                } catch {
                    if (mounted) onAdminSessionInvalid();
                }
            }
            if (mounted) await refreshDeviceStatus();
        };

        void init();

        const intervalId = window.setInterval(() => {
            if (typeof document === 'undefined' || document.visibilityState === 'visible') {
                void refreshDeviceStatus();
            }
        }, 60 * 1000);

        const handleFocusOrOnline = () => {
            void refreshDeviceStatus();
        };

        window.addEventListener('online', handleFocusOrOnline);
        window.addEventListener('focus', handleFocusOrOnline);

        return () => {
            mounted = false;
            window.clearInterval(intervalId);
            window.removeEventListener('online', handleFocusOrOnline);
            window.removeEventListener('focus', handleFocusOrOnline);
        };
    }, [onAdminSessionInvalid, refreshDeviceStatus]);

    useEffect(() => {
        return subscribeToAccessErrors((event) => {
            if (event.code === 'DEVICE_BLOCKED') {
                setIsDeviceBlocked(true);
                setAccessRestrictionReason(event.message);
                return;
            }
            if (event.code === 'ADMIN_UNAUTHORIZED') {
                onAdminSessionInvalid();
                showToast('Admin session expired. Please unlock again.', 'lock');
                return;
            }
            if (event.code === 'PERSON_ACCESS_BLOCKED' || event.code === 'CLAIM_LOCKED') {
                void refreshDeviceStatus();
            }
        });
    }, [onAdminSessionInvalid, refreshDeviceStatus, showToast]);

    const claimProfile = useCallback(
        async (name: string): Promise<ClaimActionResult> => {
            try {
                const state = await claimDeviceApi(name);
                applyServerDeviceState(state);
                applyLocalClaim(state.claimedPerson || name);
                return { ok: true };
            } catch (err) {
                return toClaimErrorResult(
                    err,
                    'Internet connection is required to verify and claim your device.'
                );
            }
        },
        [applyLocalClaim, applyServerDeviceState]
    );

    const requestClaimApproval = useCallback(async (name: string): Promise<ClaimActionResult> => {
        try {
            const state = await requestClaimApprovalApi(name);
            setDeviceState(state);
            return {
                ok: true,
                message: `Approval requested for ${name}. Ask the trip admin to approve your device.`,
            };
        } catch (err) {
            return toClaimErrorResult(err, 'Could not reach server to request approval.');
        }
    }, []);

    const unclaimDevice = useCallback(async (): Promise<boolean> => {
        try {
            const state = await unclaimDeviceApi();
            setDeviceState(state);
            clearLocalClaim();
            return true;
        } catch {
            return false;
        }
    }, [clearLocalClaim]);

    return {
        currentDeviceId,
        deviceState,
        isDeviceBlocked,
        accessRestrictionReason,
        refreshDeviceStatus,
        claimProfile,
        requestClaimApproval,
        unclaimDevice,
    };
}

