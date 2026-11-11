import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, usePushConfig, usePushStatus } from '../../../api';
import { useExpense } from '../../../context';
import { triggerHaptic } from '../../../utils/haptics';
import {
    disablePushNotifications,
    enablePushNotifications,
    getNotificationPermissionState,
    isIosSafariNotStandalone,
    isPushPausedLocally,
    isPushSupported,
    sendTestPushNotification,
} from '../../../utils/pushNotifications';

interface AdminPushStatusInput {
    iosNeedsInstall: boolean;
    pushSupported: boolean;
    isConfigLoading: boolean;
    isConfigured: boolean;
    permissionState: NotificationPermission | 'unsupported';
    isAdminAlertsReady: boolean;
    isDeviceSubscribed: boolean;
    localPaused: boolean;
    isBusy: boolean;
}

function getAdminPushBadge(isAdminAlertsReady: boolean, isDeviceSubscribed: boolean) {
    if (isAdminAlertsReady) {
        return {
            label: 'ACTIVE',
            className: 'bg-status-settled-bg text-status-settled-text',
        };
    }
    if (isDeviceSubscribed) {
        return {
            label: 'SYNC ADMIN',
            className: 'bg-status-awaiting-bg text-status-awaiting-text',
        };
    }
    return {
        label: 'OFF',
        className: 'bg-surface-card-subtle text-on-surface-variant',
    };
}

function getAdminPushDescription(status: AdminPushStatusInput): string {
    if (status.iosNeedsInstall) {
        return 'On iPhone/iPad, tap Share → Add to Home Screen first to receive admin approval alerts.';
    }
    if (!status.pushSupported) {
        return 'Web Push is not supported in this browser.';
    }
    if (status.isConfigLoading) {
        return 'Checking server VAPID notification configuration...';
    }
    if (!status.isConfigured) {
        return 'Add VAPID_PUBLIC_KEY & VAPID_PRIVATE_KEY to the backend env to enable push alerts.';
    }
    if (status.permissionState === 'denied') {
        return 'Notifications are blocked in browser Site Settings.';
    }
    if (status.isAdminAlertsReady) {
        return 'Instant push alerts arrive here whenever an unrecognized device requests profile access.';
    }
    if (status.isDeviceSubscribed) {
        return 'Device subscribed. Sync once now with Admin Mode active to receive approval requests.';
    }
    return 'Enable push notifications on your organizer device to approve new logins immediately.';
}

function getAdminPushActionLabel(status: AdminPushStatusInput): string {
    if (status.isBusy) return 'Enabling...';
    if (status.permissionState === 'denied') return 'Blocked in Browser Settings';
    if (status.isDeviceSubscribed) return 'Sync Admin Alert Role';
    if (status.localPaused) return 'Resume Admin Push Alerts';
    return 'Enable Admin Push Alerts';
}

export const AdminPushCard: React.FC = () => {
    const { claimedPerson, showToast } = useExpense();
    const queryClient = useQueryClient();
    const { data: pushConfig, isLoading: isConfigLoading } = usePushConfig(true);
    const { data: pushStatus } = usePushStatus(true);

    const [isBusy, setIsBusy] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [, setActionTick] = useState(0);

    const pushSupported = isPushSupported();
    const iosNeedsInstall = isIosSafariNotStandalone();
    const permissionState = getNotificationPermissionState();
    const localPaused = isPushPausedLocally();
    const isConfigured = Boolean(pushConfig?.configured);

    const isDeviceSubscribed =
        pushSupported &&
        permissionState === 'granted' &&
        !localPaused &&
        Boolean(pushStatus?.subscribed);

    const isAdminAlertsReady = isDeviceSubscribed && Boolean(pushStatus?.isAdminSubscribed);
    const badge = getAdminPushBadge(isAdminAlertsReady, isDeviceSubscribed);
    const statusInput: AdminPushStatusInput = {
        iosNeedsInstall,
        pushSupported,
        isConfigLoading,
        isConfigured,
        permissionState,
        isAdminAlertsReady,
        isDeviceSubscribed,
        localPaused,
        isBusy,
    };
    const description = getAdminPushDescription(statusInput);
    const actionLabel = getAdminPushActionLabel(statusInput);
    const canShowControls = pushSupported && !iosNeedsInstall && isConfigured;

    const handleEnableOrSync = async () => {
        if (isBusy || isTesting) return;
        triggerHaptic('light');
        setIsBusy(true);
        try {
            const res = await enablePushNotifications({
                person: claimedPerson,
                config: pushConfig,
            });
            if (res.ok) {
                setActionTick((t) => t + 1);
                await queryClient.invalidateQueries({ queryKey: queryKeys.pushStatus() });
                triggerHaptic('success');
                showToast(
                    res.isAdmin
                        ? 'Admin device approval alerts enabled!'
                        : 'Push alerts enabled for this device!',
                    'notifications_active'
                );
            } else {
                triggerHaptic('warning');
                showToast(res.message || 'Could not enable admin alerts', 'notifications_off');
            }
        } finally {
            setIsBusy(false);
        }
    };

    const handleTest = async () => {
        if (isTesting || isBusy) return;
        triggerHaptic('light');
        setIsTesting(true);
        try {
            const res = await sendTestPushNotification();
            triggerHaptic(res.ok ? 'success' : 'warning');
            showToast(res.message, res.ok ? 'notifications_active' : 'error');
        } finally {
            setIsTesting(false);
        }
    };

    const handlePause = async () => {
        if (isBusy || isTesting) return;
        triggerHaptic('light');
        setIsBusy(true);
        try {
            await disablePushNotifications({ markPaused: true });
            setActionTick((t) => t + 1);
            await queryClient.invalidateQueries({ queryKey: queryKeys.pushStatus() });
            showToast('Admin alerts paused on this device', 'notifications_off');
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <section className="bg-surface-card border border-border-subtle rounded-2xl p-3.5 space-y-2.5 shadow-xs">
            <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0">
                    <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isAdminAlertsReady
                                ? 'bg-status-settled-bg text-status-settled-text'
                                : 'bg-primary/10 text-primary'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[19px]">
                            {isAdminAlertsReady ? 'notifications_active' : 'notification_important'}
                        </span>
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-xs font-bold text-on-surface font-headline">
                                Admin Approval Push Alerts
                            </h3>
                            <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${badge.className}`}
                            >
                                {badge.label}
                            </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant leading-snug mt-0.5">
                            {description}
                        </p>
                    </div>
                </div>
            </div>

            {canShowControls && (
                <div className="flex items-center gap-2 pt-0.5">
                    {isAdminAlertsReady ? (
                        <>
                            <button
                                type="button"
                                disabled={isTesting || isBusy}
                                onClick={() => void handleTest()}
                                className="flex-1 h-8.5 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined text-[15px]">
                                    send
                                </span>
                                <span>{isTesting ? 'Sending...' : 'Send Test Alert'}</span>
                            </button>
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handlePause()}
                                className="h-8.5 px-3 rounded-xl bg-surface-card-subtle hover:bg-surface-container text-on-surface-variant text-xs font-semibold border border-border-subtle cursor-pointer transition-colors disabled:opacity-50"
                            >
                                Pause
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            disabled={isBusy || permissionState === 'denied'}
                            onClick={() => void handleEnableOrSync()}
                            className="w-full h-9 px-3.5 rounded-xl bg-primary hover:bg-primary-dark text-on-primary text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-[16px]">
                                notifications_active
                            </span>
                            <span>{actionLabel}</span>
                        </button>
                    )}
                </div>
            )}
        </section>
    );
};

export default AdminPushCard;
