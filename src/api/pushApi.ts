import { apiFetch } from './client';
import {
    getDeviceIdSync,
    getDevicePlatformLabel,
    getStoredClaimedPerson,
} from '../utils/deviceIdentity';
import type {
    NotifyPaymentSentPayload,
    NotifyPaymentSentResponse,
    PushDeviceStatusResponse,
    PushPublicConfig,
    PushSubscribeResponse,
    RemindParticipantPayload,
    RemindParticipantResponse,
    TestPushResponse,
    WebPushSubscriptionPayload,
} from './types';

export async function getVapidPublicKeyApi(): Promise<PushPublicConfig> {
    return apiFetch<PushPublicConfig>('/notifications/vapid-public-key');
}

export async function getPushStatusApi(): Promise<PushDeviceStatusResponse> {
    return apiFetch<PushDeviceStatusResponse>('/notifications/status');
}

export async function subscribePushApi(params: {
    subscription: WebPushSubscriptionPayload;
    person?: string | null;
}): Promise<PushSubscribeResponse> {
    return apiFetch<PushSubscribeResponse>('/notifications/subscribe', {
        method: 'POST',
        body: JSON.stringify({
            subscription: params.subscription,
            deviceId: getDeviceIdSync(),
            person: params.person ?? getStoredClaimedPerson() ?? '',
            platform: getDevicePlatformLabel(),
        }),
    });
}

export async function unsubscribePushApi(
    endpoint?: string
): Promise<{ removedCount: number }> {
    return apiFetch<{ removedCount: number }>('/notifications/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({
            endpoint: endpoint || '',
            deviceId: getDeviceIdSync(),
        }),
    });
}

export async function sendTestPushApi(): Promise<TestPushResponse> {
    return apiFetch<TestPushResponse>('/notifications/test', {
        method: 'POST',
        body: JSON.stringify({}),
    });
}

export async function remindSplitDebtorApi(
    payload: RemindParticipantPayload
): Promise<RemindParticipantResponse> {
    return apiFetch<RemindParticipantResponse>(
        `/split/${encodeURIComponent(payload.splitId)}/remind`,
        {
            method: 'POST',
            body: JSON.stringify({
                from: payload.from,
                fromUserId: payload.fromUserId || null,
                to: payload.to,
                toUserId: payload.toUserId || null,
                requestedBy: payload.requestedBy,
                ...(payload.consolidatedAmount && payload.consolidatedAmount > 0
                    ? { consolidatedAmount: payload.consolidatedAmount }
                    : {}),
                ...(payload.consolidatedCount && payload.consolidatedCount > 1
                    ? { consolidatedCount: payload.consolidatedCount }
                    : {}),
            }),
        }
    );
}

export async function notifyPaymentSentApi(
    payload: NotifyPaymentSentPayload
): Promise<NotifyPaymentSentResponse> {
    const splitIdPath = payload.splitId
        ? `/splits/${encodeURIComponent(payload.splitId)}/notify-payment-sent`
        : '/splits/notify-payment-sent';
    return apiFetch<NotifyPaymentSentResponse>(splitIdPath, {
        method: 'POST',
        body: JSON.stringify({
            splitId: payload.splitId,
            splitIds: payload.splitIds,
            groupId: payload.groupId,
            from: payload.from,
            fromUserId: payload.fromUserId || null,
            to: payload.to,
            toUserId: payload.toUserId || null,
            amount: payload.amount,
            description: payload.description,
            requestedBy: payload.requestedBy,
        }),
    });
}

