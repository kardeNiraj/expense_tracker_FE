import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, usePushConfig, usePushStatus } from '../../api';
import { triggerHaptic } from '../../utils/haptics';
import {
    disablePushNotifications,
    enablePushNotifications,
    getNotificationPermissionState,
    isIosSafariNotStandalone,
    isPushPausedLocally,
    isPushSupported,
    sendTestPushNotification,
} from '../../utils/pushNotifications';

interface ProfilePushControlProps {
    claimedPerson: string | null;
    showToast: (message: string, icon?: string) => void;
}

interface PushSubtitleInput {
    iosNeedsInstall: boolean;
    pushSupported: boolean;
    isPushConfigLoading: boolean;
    isPushConfigured: boolean;
    permissionState: NotificationPermission | 'unsupported';
    isPushActive: boolean;
    localPushPaused: boolean;
}

function getPushSubtitleText(input: PushSubtitleInput): string {
    if (input.iosNeedsInstall) return 'Add to Home Screen on iOS for push alerts';
    if (!input.pushSupported) return 'Browser does not support Web Push';
    if (input.isPushConfigLoading) return 'Checking server push configuration...';
    if (!input.isPushConfigured) return 'VAPID keys not configured on server yet';
    if (input.permissionState === 'denied') return 'Blocked in browser site settings';
    if (input.isPushActive) return 'Instant split, reminder & settle alerts on';
    if (input.localPushPaused) return 'Paused on this device';
    return 'Get notified for splits & reminders';
}

function getEnableButtonLabel(
    isPushBusy: boolean,
    permissionState: NotificationPermission | 'unsupported',
    localPushPaused: boolean
): string {
    if (isPushBusy) return '...';
    if (permissionState === 'denied') return 'Blocked';
    if (localPushPaused) return 'Resume';
    return 'Enable';
}

function useProfilePushActions(
    claimedPerson: string | null,
    showToast: (message: string, icon?: string) => void
) {
    const queryClient = useQueryClient();
    const [isPushBusy, setIsPushBusy] = useState(false);
    const [isTestingPush, setIsTestingPush] = useState(false);
    const [, setPushActionTick] = useState(0);

    const { data: pushConfig, isLoading: isPushConfigLoading } = usePushConfig(true);
    const { data: pushStatus } = usePushStatus(true);

    const pushSupported = isPushSupported();
    const iosNeedsInstall = isIosSafariNotStandalone();
    const permissionState = getNotificationPermissionState();
    const localPushPaused = isPushPausedLocally();
    const isPushConfigured = Boolean(pushConfig?.configured);
    const isPushActive =
        pushSupported &&
        permissionState === 'granted' &&
        !localPushPaused &&
        Boolean(pushStatus?.subscribed ?? true);

    const handleEnablePush = async () => {
        if (isPushBusy || isTestingPush) return;
        triggerHaptic('light');
        setIsPushBusy(true);
        try {
            const res = await enablePushNotifications({
                person: claimedPerson,
                config: pushConfig,
            });
            if (res.ok) {
                setPushActionTick((t) => t + 1);
                triggerHaptic('success');
                await queryClient.invalidateQueries({ queryKey: queryKeys.pushStatus() });
                showToast(res.message || 'Push notifications enabled!', 'notifications_active');
            } else {
                triggerHaptic('warning');
                showToast(res.message || 'Could not enable push alerts', 'notifications_off');
            }
        } finally {
            setIsPushBusy(false);
        }
    };

    const handlePausePush = async () => {
        if (isPushBusy || isTestingPush) return;
        triggerHaptic('light');
        setIsPushBusy(true);
        try {
            await disablePushNotifications({ markPaused: true });
            setPushActionTick((t) => t + 1);
            await queryClient.invalidateQueries({ queryKey: queryKeys.pushStatus() });
            showToast('Push notifications paused on this device', 'notifications_off');
        } finally {
            setIsPushBusy(false);
        }
    };

    const handleTestPush = async () => {
        if (isTestingPush || isPushBusy) return;
        triggerHaptic('light');
        setIsTestingPush(true);
        try {
            const res = await sendTestPushNotification();
            triggerHaptic(res.ok ? 'success' : 'warning');
            showToast(res.message, res.ok ? 'notifications_active' : 'error');
        } finally {
            setIsTestingPush(false);
        }
    };

    return {
        iosNeedsInstall,
        isPushActive,
        isAdminSubscribed: Boolean(pushStatus?.isAdminSubscribed),
        canShowControls: !iosNeedsInstall && isPushConfigured && pushSupported,
        permissionDenied: permissionState === 'denied',
        isPushBusy,
        isTestingPush,
        subtitleText: getPushSubtitleText({
            iosNeedsInstall,
            pushSupported,
            isPushConfigLoading,
            isPushConfigured,
            permissionState,
            isPushActive,
            localPushPaused,
        }),
        enableLabel: getEnableButtonLabel(isPushBusy, permissionState, localPushPaused),
        handleEnablePush,
        handlePausePush,
        handleTestPush,
    };
}

interface PushActionButtonsProps {
    iosNeedsInstall: boolean;
    canShowControls: boolean;
    isPushActive: boolean;
    showIosPushTip: boolean;
    isTestingPush: boolean;
    isPushBusy: boolean;
    permissionDenied: boolean;
    enableLabel: string;
    onToggleIosTip: () => void;
    onTestPush: () => void;
    onPausePush: () => void;
    onEnablePush: () => void;
}

const PushActionButtons: React.FC<PushActionButtonsProps> = ({
    iosNeedsInstall,
    canShowControls,
    isPushActive,
    showIosPushTip,
    isTestingPush,
    isPushBusy,
    permissionDenied,
    enableLabel,
    onToggleIosTip,
    onTestPush,
    onPausePush,
    onEnablePush,
}) => {
    if (iosNeedsInstall) {
        return (
            <button
                type="button"
                onClick={onToggleIosTip}
                className="h-8 px-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold cursor-pointer transition-colors"
            >
                {showIosPushTip ? 'Hide' : 'How?'}
            </button>
        );
    }

    if (!canShowControls) return null;

    if (isPushActive) {
        return (
            <>
                <button
                    type="button"
                    disabled={isTestingPush || isPushBusy}
                    onClick={onTestPush}
                    className="h-8 px-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-primary text-xs font-bold border border-outline-variant/30 cursor-pointer transition-colors disabled:opacity-50"
                    title="Send a test notification to this device"
                >
                    {isTestingPush ? '...' : 'Test'}
                </button>
                <button
                    type="button"
                    disabled={isPushBusy}
                    onClick={onPausePush}
                    className="h-8 px-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-xs font-semibold border border-outline-variant/20 cursor-pointer transition-colors disabled:opacity-50"
                    title="Pause push notifications on this device"
                >
                    {isPushBusy ? '...' : 'Pause'}
                </button>
            </>
        );
    }

    return (
        <button
            type="button"
            disabled={isPushBusy || permissionDenied}
            onClick={onEnablePush}
            className="h-8 px-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-dark cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1"
        >
            <span className="material-symbols-outlined text-[14px]">notifications_active</span>
            <span>{enableLabel}</span>
        </button>
    );
};

export const ProfilePushControl: React.FC<ProfilePushControlProps> = ({
    claimedPerson,
    showToast,
}) => {
    const [showIosPushTip, setShowIosPushTip] = useState(false);
    const push = useProfilePushActions(claimedPerson, showToast);

    return (
        <div className="px-0.5 pb-1.5 border-b border-outline-variant/15 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-on-surface-variant min-w-0">
                    <span
                        className={`material-symbols-outlined text-[17px] shrink-0 ${
                            push.isPushActive ? 'text-primary' : 'text-on-surface-variant'
                        }`}
                    >
                        {push.isPushActive ? 'notifications_active' : 'notifications'}
                    </span>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-on-surface text-[11px] leading-tight">
                                Push Alerts &amp; Reminders
                            </span>
                            {push.isPushActive && push.isAdminSubscribed && (
                                <span className="px-1.5 py-0.2 rounded-md bg-primary-fixed text-on-primary-fixed text-[9px] font-bold">
                                    Admin
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] text-on-surface-variant block truncate">
                            {push.subtitleText}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <PushActionButtons
                        iosNeedsInstall={push.iosNeedsInstall}
                        canShowControls={push.canShowControls}
                        isPushActive={push.isPushActive}
                        showIosPushTip={showIosPushTip}
                        isTestingPush={push.isTestingPush}
                        isPushBusy={push.isPushBusy}
                        permissionDenied={push.permissionDenied}
                        enableLabel={push.enableLabel}
                        onToggleIosTip={() => setShowIosPushTip((v) => !v)}
                        onTestPush={() => void push.handleTestPush()}
                        onPausePush={() => void push.handlePausePush()}
                        onEnablePush={() => void push.handleEnablePush()}
                    />
                </div>
            </div>

            {push.iosNeedsInstall && showIosPushTip && (
                <p className="text-[10px] text-on-surface-variant bg-surface-container-low rounded-xl px-2.5 py-2 border border-outline-variant/20">
                    On iPhone or iPad, tap <strong className="text-on-surface">Share → Add to Home Screen</strong> in Safari, then open SplitNest from your Home Screen and tap Enable.
                </p>
            )}
        </div>
    );
};

export default ProfilePushControl;
