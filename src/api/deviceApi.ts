import { apiFetch } from './client';
import { getDeviceIdSync, getDevicePlatformLabel } from '../utils/deviceIdentity';
import type {
    AdminLoginResponse,
    AdminUpdateDevicePayload,
    DeviceStateResponse,
} from './types';

function getUserAgentSnippet(): string {
    if (typeof navigator === 'undefined') return '';
    return (navigator.userAgent || '').slice(0, 300);
}

export async function loginAdminApi(passcode: string): Promise<AdminLoginResponse> {
    return apiFetch<AdminLoginResponse>('/admin/login', {
        method: 'POST',
        body: JSON.stringify({
            passcode: passcode.trim(),
            deviceId: getDeviceIdSync(),
        }),
    });
}

export async function verifyAdminTokenApi(): Promise<{
    valid: boolean;
    role: string;
    exp: number | null;
}> {
    return apiFetch('/admin/verify', { method: 'GET' });
}

export async function heartbeatDeviceApi(params: {
    claimedPerson?: string | null;
    activePerson?: string | null;
}): Promise<DeviceStateResponse> {
    return apiFetch<DeviceStateResponse>('/devices/heartbeat', {
        method: 'POST',
        body: JSON.stringify({
            deviceId: getDeviceIdSync(),
            platform: getDevicePlatformLabel(),
            claimedPerson: params.claimedPerson ?? null,
            activePerson: params.activePerson ?? null,
        }),
    });
}

export async function claimDeviceApi(person: string): Promise<DeviceStateResponse> {
    return apiFetch<DeviceStateResponse>('/devices/claim', {
        method: 'POST',
        body: JSON.stringify({
            deviceId: getDeviceIdSync(),
            person: person.trim(),
            platform: getDevicePlatformLabel(),
            userAgent: getUserAgentSnippet(),
        }),
    });
}

export async function requestClaimApprovalApi(person: string): Promise<DeviceStateResponse> {
    return apiFetch<DeviceStateResponse>('/devices/request-approval', {
        method: 'POST',
        body: JSON.stringify({
            deviceId: getDeviceIdSync(),
            person: person.trim(),
            platform: getDevicePlatformLabel(),
            userAgent: getUserAgentSnippet(),
        }),
    });
}

export async function unclaimDeviceApi(passcode?: string): Promise<DeviceStateResponse> {
    return apiFetch<DeviceStateResponse>('/devices/unclaim', {
        method: 'POST',
        body: JSON.stringify({
            deviceId: getDeviceIdSync(),
            ...(passcode ? { passcode } : {}),
        }),
    });
}

export async function updateAdminDeviceApi(
    deviceId: string,
    updates: AdminUpdateDevicePayload
): Promise<DeviceStateResponse> {
    return apiFetch<DeviceStateResponse>(`/admin/devices/${encodeURIComponent(deviceId)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
    });
}

export async function setPersonLockApi(
    person: string,
    locked: boolean
): Promise<{ person: string; locked: boolean; updatedAt: string; updatedBy: string }> {
    return apiFetch(`/admin/locks/${encodeURIComponent(person)}`, {
        method: 'PUT',
        body: JSON.stringify({ locked }),
    });
}

export async function setBulkPersonLocksApi(
    locked: boolean,
    people?: string[]
): Promise<Array<{ person: string; locked: boolean; updatedAt: string; updatedBy: string }>> {
    return apiFetch('/admin/locks', {
        method: 'POST',
        body: JSON.stringify({
            locked,
            ...(people && people.length > 0 ? { people } : {}),
        }),
    });
}

