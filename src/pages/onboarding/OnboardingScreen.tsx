import React, { lazy, Suspense, useMemo, useState } from 'react';
import { ENV } from '../../config';
import { useExpense } from '../../context';
import {
    ApiError,
    authenticateWithGoogleApi,
    authenticateWithPinApi,
    forgotPasswordApi,
    loginWithEmailApi,
    registerWithEmailApi,
    resetPasswordApi,
    useCreateGroupMutation,
    useGroupInvitePreview,
    useJoinGroupMutation,
    useUpdateProfileMutation,
} from '../../api';
import { AppIcon } from '../../components';
import { triggerHaptic } from '../../utils/haptics';
import { parseGroupInviteCode } from '../../utils/qr';
import { GoogleSignInButton } from './GoogleSignInButton';

const QrScannerModal = lazy(() => import('../../components/QRScanner/QrScannerModal'));

const ROOM_ICONS = [
    { id: 'groups', label: 'Group' },
    { id: 'landscape', label: 'Trip' },
    { id: 'flight', label: 'Travel' },
    { id: 'hotel', label: 'Home/Flat' },
    { id: 'beach_access', label: 'Beach' },
    { id: 'camping', label: 'Camp' },
    { id: 'forest', label: 'Nature' },
    { id: 'rocket_launch', label: 'Event' },
] as const;

export const OnboardingScreen: React.FC = () => {
    const {
        user,
        isAuthenticated,
        authConfig,
        groups,
        formerGroups,
        pendingInviteCode,
        setPendingInviteCode,
        pendingRecoverToken,
        clearPendingRecoverToken,
        completeAuthSession,
        onJoinedOrCreatedGroup,
        setActiveGroupId,
        setActiveTab,
        logoutUser,
        showToast,
    } = useExpense();

    // Auth Tabs & Inputs
    const [authMethod, setAuthMethod] = useState<'email' | 'pin'>('email');
    const [emailMode, setEmailMode] = useState<'register' | 'login' | 'recover'>(() =>
        pendingRecoverToken ? 'recover' : 'register'
    );
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [pin, setPin] = useState('');
    const [upiId, setUpiId] = useState('');
    const [authError, setAuthError] = useState<string | null>(null);
    const [isAuthBusy, setIsAuthBusy] = useState(false);

    // Email Recovery State
    const [recoveryStep, setRecoveryStep] = useState<'request' | 'reset'>(() =>
        pendingRecoverToken ? 'reset' : 'request'
    );
    const [recoveryCode, setRecoveryCode] = useState('');
    const [recoveryStatusMsg, setRecoveryStatusMsg] = useState<string | null>(null);
    const [devPreviewCode, setDevPreviewCode] = useState<string | null>(null);

    const effectiveEmailMode = pendingRecoverToken ? 'recover' : emailMode;
    const effectiveRecoveryStep = pendingRecoverToken ? 'reset' : recoveryStep;

    // Room Step Tabs & Inputs
    const [roomAction, setRoomAction] = useState<'create' | 'join'>('create');
    const [roomName, setRoomName] = useState('');
    const [roomSubtitle, setRoomSubtitle] = useState('');
    const [roomIcon, setRoomIcon] = useState<string>('groups');
    const [memberDraft, setMemberDraft] = useState('');
    const [initialMembers, setInitialMembers] = useState<string[]>([]);
    const [joinCodeInput, setJoinCodeInput] = useState('');
    const [selectedLinkSlot, setSelectedLinkSlot] = useState<string>('__new__');
    const [customJoinName, setCustomJoinName] = useState('');
    const [joinUpiInput, setJoinUpiInput] = useState('');
    const [roomError, setRoomError] = useState<string | null>(null);
    const [showInviteScanner, setShowInviteScanner] = useState(false);

    const invitePreviewQuery = useGroupInvitePreview(pendingInviteCode);
    const createGroupMutation = useCreateGroupMutation();
    const joinGroupMutation = useJoinGroupMutation();
    const updateProfileMutation = useUpdateProfileMutation();

    const [isVerifyingGoogle, setIsVerifyingGoogle] = useState(false);
    const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
    const [displayNameDraft, setDisplayNameDraft] = useState('');
    const [displayNameError, setDisplayNameError] = useState<string | null>(null);

    const effectiveGoogleClientId = ENV.GOOGLE_CLIENT_ID || authConfig?.googleClientId || '';
    const googleEnabled = Boolean(
        authConfig?.googleEnabled || (effectiveGoogleClientId && authConfig === null)
    );

    const effectiveJoinLinkSlot = useMemo(() => {
        const preview = invitePreviewQuery.data;
        if (!preview || !user) return '__new__';
        if (selectedLinkSlot !== '__new__') return selectedLinkSlot;
        const autoMatch = preview.unclaimedMembers.find(
            (m) => m.name.trim().toLowerCase() === user.name.trim().toLowerCase()
        );
        return autoMatch ? autoMatch.name : '__new__';
    }, [invitePreviewQuery.data, selectedLinkSlot, user]);

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError(null);
        setIsAuthBusy(true);
        try {
            const cleanName = name.trim();
            const cleanEmail = email.trim();
            if (effectiveEmailMode === 'recover') {
                if (effectiveRecoveryStep === 'request' && !pendingRecoverToken) {
                    if (!cleanEmail) {
                        setAuthError('Enter your registered email address.');
                        return;
                    }
                    const res = await forgotPasswordApi({ email: cleanEmail });
                    setRecoveryStatusMsg(
                        res.message ||
                            'If an account exists for that email, a 6-digit recovery code and reset link have been sent.'
                    );
                    setDevPreviewCode(res.devRecoveryCode || null);
                    setRecoveryStep('reset');
                    triggerHaptic('success');
                    showToast('Recovery instructions sent!', 'lock_reset');
                    return;
                }

                // Step 2: Reset password via link token (?recover=) OR 6-digit code
                const cleanCode = recoveryCode.trim();
                if (!pendingRecoverToken && (!cleanEmail || !cleanCode)) {
                    setAuthError('Enter your email and the 6-digit recovery code.');
                    return;
                }
                if (!password || password.length < 6) {
                    setAuthError('New password must be at least 6 characters.');
                    return;
                }
                const res = await resetPasswordApi({
                    ...(pendingRecoverToken
                        ? { token: pendingRecoverToken }
                        : { email: cleanEmail, code: cleanCode }),
                    newPassword: password,
                });
                clearPendingRecoverToken();
                setDevPreviewCode(null);
                setRecoveryStatusMsg(null);
                setRecoveryCode('');
                setPassword('');
                completeAuthSession(res);
                triggerHaptic('success');
                showToast(`Password updated! Signed in as ${res.user.name}.`, 'verified_user');
                return;
            }

            if (effectiveEmailMode === 'register') {
                if (!cleanName || cleanName.length < 2) {
                    setAuthError('Please enter your name (at least 2 characters).');
                    return;
                }
                const res = await registerWithEmailApi({
                    name: cleanName,
                    email: cleanEmail,
                    password,
                    ...(upiId.trim() ? { upiId: upiId.trim() } : {}),
                });
                completeAuthSession(res);
                triggerHaptic('success');
                showToast(
                    pendingInviteCode
                        ? `Welcome ${res.user.name}! Review and join your invited room.`
                        : `Welcome ${res.user.name}!`,
                    'verified_user'
                );
            } else {
                const res = await loginWithEmailApi({
                    email: cleanEmail,
                    password,
                });
                completeAuthSession(res);
                triggerHaptic('success');
                showToast(`Signed in as ${res.user.name}`, 'verified_user');
            }
        } catch (err) {
            triggerHaptic('warning');
            setAuthError(
                err instanceof ApiError
                    ? err.message
                    : 'Unable to authenticate. Check your internet connection.'
            );
        } finally {
            setIsAuthBusy(false);
        }
    };

    const handlePinSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError(null);
        const cleanName = name.trim();
        const cleanPin = pin.trim();
        if (cleanName.length < 2) {
            setAuthError('Enter your display name (at least 2 characters).');
            return;
        }
        if (!/^\d{4,6}$/.test(cleanPin)) {
            setAuthError('PIN must be 4 to 6 digits.');
            return;
        }

        setIsAuthBusy(true);
        try {
            const res = await authenticateWithPinApi({
                name: cleanName,
                pin: cleanPin,
                ...(upiId.trim() ? { upiId: upiId.trim() } : {}),
            });
            completeAuthSession(res);
            triggerHaptic('success');
            showToast(
                res.isNewUser
                    ? `Account created for ${res.user.name}!`
                    : `Welcome back, ${res.user.name}!`,
                'verified_user'
            );
        } catch (err) {
            triggerHaptic('warning');
            setAuthError(
                err instanceof ApiError
                    ? err.message
                    : 'PIN sign-in failed. Please try again.'
            );
        } finally {
            setIsAuthBusy(false);
        }
    };

    const handleGoogleCredential = async (credential: string) => {
        setAuthError(null);
        setIsAuthBusy(true);
        setIsVerifyingGoogle(true);
        try {
            const res = await authenticateWithGoogleApi({ credential });
            completeAuthSession(res);
            triggerHaptic('success');
            showToast(`Signed in with Google as ${res.user.name}!`, 'verified_user');
        } catch (err) {
            triggerHaptic('warning');
            setAuthError(
                err instanceof ApiError
                    ? err.message
                    : 'Google sign-in failed. Please try again.'
            );
        } finally {
            setIsAuthBusy(false);
            setIsVerifyingGoogle(false);
        }
    };

    const handleStartEditName = () => {
        setDisplayNameDraft(user?.name || '');
        setDisplayNameError(null);
        setIsEditingDisplayName(true);
    };

    const handleSaveDisplayName = async (e: React.FormEvent) => {
        e.preventDefault();
        const clean = displayNameDraft.trim();
        if (clean.length < 2) {
            setDisplayNameError('Name must be at least 2 characters.');
            return;
        }
        setDisplayNameError(null);
        try {
            const res = await updateProfileMutation.mutateAsync({ name: clean });
            triggerHaptic('success');
            setIsEditingDisplayName(false);
            showToast(`Display name updated to ${res.user.name}!`, 'badge');
        } catch (err) {
            triggerHaptic('warning');
            setDisplayNameError(err instanceof Error ? err.message : 'Failed to update name');
        }
    };

    const handleAddInitialMember = () => {
        const clean = memberDraft.trim();
        if (!clean) return;
        const alreadyInList = initialMembers.some(
            (m) => m.toLowerCase() === clean.toLowerCase()
        );
        const isSelf = Boolean(user && user.name.trim().toLowerCase() === clean.toLowerCase());
        if (!alreadyInList && !isSelf) {
            setInitialMembers((prev) => [...prev, clean]);
        }
        setMemberDraft('');
    };

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        setRoomError(null);
        const cleanTitle = roomName.trim();
        if (cleanTitle.length < 2) {
            setRoomError('Enter a room or trip name (at least 2 characters).');
            return;
        }

        try {
            const created = await createGroupMutation.mutateAsync({
                name: cleanTitle,
                ...(roomSubtitle.trim() ? { subtitle: roomSubtitle.trim() } : {}),
                icon: roomIcon,
                initialMembers,
            });
            triggerHaptic('success');
            showToast(`Room "${created.name}" created! Share QR ${created.inviteCode} to invite friends.`);
            onJoinedOrCreatedGroup(created);
        } catch (err) {
            triggerHaptic('warning');
            setRoomError(
                err instanceof ApiError ? err.message : 'Failed to create room. Try again.'
            );
        }
    };

    const handleConfirmJoinInvitedRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pendingInviteCode) return;
        setRoomError(null);

        try {
            const linkMemberName =
                effectiveJoinLinkSlot !== '__new__' ? effectiveJoinLinkSlot : undefined;
            const displayName =
                effectiveJoinLinkSlot === '__new__' && customJoinName.trim()
                    ? customJoinName.trim()
                    : undefined;
            const res = await joinGroupMutation.mutateAsync({
                inviteCode: pendingInviteCode,
                ...(linkMemberName ? { linkMemberName } : {}),
                ...(displayName ? { displayName } : {}),
                ...(joinUpiInput.trim() ? { upiId: joinUpiInput.trim() } : {}),
            });
            triggerHaptic('success');
            showToast(`Joined "${res.group.name}" as ${res.joinedAs}!`, 'check_circle');
            onJoinedOrCreatedGroup(res.group);
        } catch (err) {
            triggerHaptic('warning');
            setRoomError(
                err instanceof ApiError ? err.message : 'Could not join room. Check the invite code.'
            );
        }
    };

    const handleLookupCodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setRoomError(null);
        const parsed = parseGroupInviteCode(joinCodeInput);
        if (!parsed) {
            setRoomError('Enter a valid invite code or SplitNest invite link.');
            return;
        }
        setSelectedLinkSlot('__new__');
        setPendingInviteCode(parsed);
        setJoinCodeInput('');
    };

    const preview = invitePreviewQuery.data;

    return (
        <div className="min-h-screen w-full max-w-md mx-auto px-4 pt-6 pb-14 flex flex-col justify-between space-y-5">
            <div className="space-y-5">
                {/* Brand Hero */}
                <div className="flex flex-col items-center text-center space-y-2.5 pt-2">
                    <div className="w-16 h-16 rounded-3xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-sm">
                        <AppIcon name={preview?.icon || 'groups'} className="text-[34px]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-on-surface font-headline">
                            SplitNest
                        </h1>
                        <p className="text-xs text-on-surface-variant max-w-xs mx-auto mt-0.5">
                            Create a room, share a QR invite, and track group expenses cleanly per room.
                        </p>
                    </div>
                </div>

                {/* Pending QR Invite Banner (visible even before signing in!) */}
                {pendingInviteCode && (
                    <div className="rounded-2xl bg-primary/10 border border-primary/30 p-3.5 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-xs">
                                    <AppIcon name={preview?.icon || 'qr_code_2'} className="text-[20px]" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary block">
                                        Room Invite • {pendingInviteCode}
                                    </span>
                                    <h2 className="text-sm font-bold text-on-surface truncate">
                                        {invitePreviewQuery.isLoading
                                            ? 'Checking room invite...'
                                            : preview
                                              ? preview.name
                                              : 'Invite Code Ready'}
                                    </h2>
                                    {preview && (
                                        <p className="text-[11px] text-on-surface-variant truncate">
                                            By {preview.createdByName || 'Host'} • {preview.memberCount}{' '}
                                            {preview.memberCount === 1 ? 'member' : 'members'}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPendingInviteCode(null)}
                                className="w-7 h-7 rounded-full hover:bg-primary/15 flex items-center justify-center text-on-surface-variant cursor-pointer shrink-0"
                                title="Dismiss invite"
                            >
                                <AppIcon name="close" className="text-[16px]" />
                            </button>
                        </div>

                        {invitePreviewQuery.isError && (
                            <p className="text-[11px] text-error font-medium">
                                Invite code &quot;{pendingInviteCode}&quot; was not found or expired.
                            </p>
                        )}

                        {!isAuthenticated && preview && (
                            <p className="text-[11px] text-on-surface-variant">
                                Sign in or create an account below to immediately join{' '}
                                <strong className="text-on-surface">{preview.name}</strong>.
                            </p>
                        )}
                    </div>
                )}

                {/* STEP 1: SIGN IN / REGISTER */}
                {!isAuthenticated ? (
                    <div className="rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm p-4 space-y-4">
                        {/* Method Selector */}
                        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-surface-container-low border border-outline-variant/25">
                            <button
                                type="button"
                                onClick={() => {
                                    setAuthMethod('email');
                                    setAuthError(null);
                                }}
                                className={`h-9 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                    authMethod === 'email'
                                        ? 'bg-surface-container-lowest text-primary shadow-xs'
                                        : 'text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                <AppIcon name="verified_user" className="text-[16px]" />
                                <span>Email &amp; Password</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setAuthMethod('pin');
                                    setAuthError(null);
                                }}
                                className={`h-9 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                    authMethod === 'pin'
                                        ? 'bg-surface-container-lowest text-primary shadow-xs'
                                        : 'text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                <AppIcon name="tag" className="text-[16px]" />
                                <span>Quick PIN</span>
                            </button>
                        </div>

                        {authError && (
                            <div className="p-3 rounded-xl bg-error/10 border border-error/25 text-xs text-error flex items-start gap-2">
                                <AppIcon name="error" className="text-[16px] shrink-0 mt-0.5" />
                                <span>{authError}</span>
                            </div>
                        )}

                        {authMethod === 'email' ? (
                            <form onSubmit={handleEmailSubmit} className="space-y-3">
                                <div className="flex items-center justify-between text-xs gap-2">
                                    <span className="font-bold text-on-surface flex items-center gap-1.5">
                                        {effectiveEmailMode === 'recover' && (
                                            <AppIcon name="lock_reset" className="text-[16px] text-primary" />
                                        )}
                                        <span>
                                            {effectiveEmailMode === 'register'
                                                ? 'Create your account'
                                                : effectiveEmailMode === 'recover'
                                                  ? 'Recover your account'
                                                  : 'Welcome back'}
                                        </span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (effectiveEmailMode === 'recover') {
                                                clearPendingRecoverToken();
                                                setEmailMode('login');
                                                setRecoveryStep('request');
                                                setRecoveryStatusMsg(null);
                                                setDevPreviewCode(null);
                                            } else {
                                                setEmailMode((m) =>
                                                    m === 'register' ? 'login' : 'register'
                                                );
                                            }
                                            setAuthError(null);
                                        }}
                                        className="text-primary font-semibold hover:underline cursor-pointer shrink-0"
                                    >
                                        {effectiveEmailMode === 'register'
                                            ? 'Already registered? Sign In'
                                            : effectiveEmailMode === 'recover'
                                              ? 'Back to Sign In'
                                              : 'New here? Register'}
                                    </button>
                                </div>

                                {effectiveEmailMode === 'recover' && pendingRecoverToken && (
                                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/25 text-[11px] text-primary flex items-center justify-between gap-2">
                                        <span className="flex items-center gap-1.5 font-semibold">
                                            <AppIcon name="verified_user" className="text-[15px] shrink-0" />
                                            <span>Reset link detected — choose your new password below.</span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                clearPendingRecoverToken();
                                                setRecoveryStep('request');
                                            }}
                                            className="text-[10px] font-bold underline cursor-pointer shrink-0"
                                        >
                                            Use code instead
                                        </button>
                                    </div>
                                )}

                                {effectiveEmailMode === 'recover' && recoveryStatusMsg && (
                                    <div className="p-2.5 rounded-xl bg-status-settled-bg/60 border border-primary/25 text-[11px] text-on-surface space-y-1">
                                        <p>{recoveryStatusMsg}</p>
                                        {devPreviewCode && (
                                            <p className="font-mono text-xs font-bold text-primary">
                                                Dev Preview Recovery Code: {devPreviewCode}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {effectiveEmailMode === 'register' && (
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-semibold text-on-surface-variant">
                                            Your Name
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="e.g. Niraj"
                                            required
                                            className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                )}

                                {(effectiveEmailMode !== 'recover' || !pendingRecoverToken) && (
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-semibold text-on-surface-variant">
                                            Email Address
                                        </label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            required
                                            className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                )}

                                {effectiveEmailMode === 'recover' &&
                                    effectiveRecoveryStep === 'reset' &&
                                    !pendingRecoverToken && (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[11px] font-semibold text-on-surface-variant">
                                                    6-Digit Recovery Code
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setRecoveryStep('request');
                                                        setRecoveryStatusMsg(null);
                                                        setDevPreviewCode(null);
                                                    }}
                                                    className="text-[11px] text-primary font-semibold hover:underline cursor-pointer"
                                                >
                                                    Resend code
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={6}
                                                value={recoveryCode}
                                                onChange={(e) =>
                                                    setRecoveryCode(e.target.value.replace(/\D/g, ''))
                                                }
                                                placeholder="6-digit code from email"
                                                required
                                                className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm font-mono tracking-widest text-on-surface focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                    )}

                                {(effectiveEmailMode !== 'recover' ||
                                    effectiveRecoveryStep === 'reset' ||
                                    Boolean(pendingRecoverToken)) && (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-semibold text-on-surface-variant">
                                                {effectiveEmailMode === 'recover'
                                                    ? 'New Password'
                                                    : 'Password'}
                                            </label>
                                            {effectiveEmailMode === 'login' && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEmailMode('recover');
                                                        setRecoveryStep('request');
                                                        setRecoveryStatusMsg(null);
                                                        setDevPreviewCode(null);
                                                        setPassword('');
                                                        setAuthError(null);
                                                    }}
                                                    className="text-[11px] text-primary font-semibold hover:underline cursor-pointer"
                                                >
                                                    Forgot password?
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder={
                                                effectiveEmailMode === 'register' ||
                                                effectiveEmailMode === 'recover'
                                                    ? 'At least 6 characters'
                                                    : 'Enter password'
                                            }
                                            minLength={6}
                                            required
                                            className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                )}

                                {effectiveEmailMode === 'register' && (
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-semibold text-on-surface-variant">
                                            UPI ID (optional, for receiving payments)
                                        </label>
                                        <input
                                            type="text"
                                            value={upiId}
                                            onChange={(e) => setUpiId(e.target.value)}
                                            placeholder="name@okhdfcbank"
                                            className="w-full h-10 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isAuthBusy}
                                    className="w-full h-11 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
                                >
                                    {isAuthBusy
                                        ? 'Please wait...'
                                        : effectiveEmailMode === 'register'
                                          ? 'Create Account & Continue'
                                          : effectiveEmailMode === 'recover'
                                            ? effectiveRecoveryStep === 'request' &&
                                              !pendingRecoverToken
                                                ? 'Send Recovery Code'
                                                : 'Reset Password & Sign In'
                                            : 'Sign In'}
                                </button>

                                {effectiveEmailMode === 'register' && (
                                    <div className="text-center pt-0.5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEmailMode('recover');
                                                setRecoveryStep('request');
                                                setRecoveryStatusMsg(null);
                                                setDevPreviewCode(null);
                                                setPassword('');
                                                setAuthError(null);
                                            }}
                                            className="text-[11px] text-on-surface-variant hover:text-primary font-semibold hover:underline cursor-pointer"
                                        >
                                            Forgot password on an existing account? Recover via email
                                        </button>
                                    </div>
                                )}
                            </form>
                        ) : (
                            <form onSubmit={handlePinSubmit} className="space-y-3">
                                <p className="text-xs text-on-surface-variant">
                                    Fast room onboarding — pick a display name &amp; 4–6 digit PIN. Returning with the same name &amp; PIN signs you right back in.
                                </p>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-on-surface-variant">
                                        Display Name
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. Rahul"
                                        required
                                        className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-on-surface-variant">
                                        4–6 Digit PIN
                                    </label>
                                    <input
                                        type="password"
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={pin}
                                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                        placeholder="••••"
                                        required
                                        className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm font-mono tracking-widest text-on-surface focus:outline-none focus:border-primary"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-on-surface-variant">
                                        UPI ID (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={upiId}
                                        onChange={(e) => setUpiId(e.target.value)}
                                        placeholder="name@oksbi"
                                        className="w-full h-10 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isAuthBusy}
                                    className="w-full h-11 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
                                >
                                    {isAuthBusy ? 'Signing in...' : 'Continue with Quick PIN'}
                                </button>
                            </form>
                        )}

                        <div className="relative py-1 flex items-center">
                            <div className="flex-1 border-t border-outline-variant/25" />
                            <span className="px-3 text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">
                                Or continue with Google
                            </span>
                            <div className="flex-1 border-t border-outline-variant/25" />
                        </div>

                        {isVerifyingGoogle && (
                            <div className="p-3.5 rounded-2xl bg-primary/8 border border-primary/25 flex items-center gap-3 animate-in fade-in duration-200">
                                <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
                                    <AppIcon name="progress_activity" className="text-[18px] animate-spin" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-on-surface">Verifying with Google...</p>
                                    <p className="text-[11px] text-on-surface-variant">Connecting your Google profile to SplitNest</p>
                                </div>
                            </div>
                        )}

                        <GoogleSignInButton
                            clientId={effectiveGoogleClientId}
                            enabled={googleEnabled}
                            disabled={isAuthBusy}
                            isVerifying={isVerifyingGoogle}
                            onCredential={handleGoogleCredential}
                        />

                        {!pendingInviteCode && (
                            <div className="pt-1 border-t border-outline-variant/20 flex items-center justify-between gap-2">
                                <span className="text-[11px] text-on-surface-variant">
                                    Have a friend&apos;s room QR?
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowInviteScanner(true)}
                                    className="px-3 h-8 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                                >
                                    <AppIcon name="qr_code_scanner" className="text-[15px]" />
                                    <span>Scan Invite QR</span>
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    /* STEP 2: JOIN INVITED ROOM OR CREATE FIRST ROOM */
                    <div className="space-y-4">
                        {/* Signed-in Account Pill */}
                        <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 px-3.5 py-2.5 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <AppIcon name="verified_user" className="text-[15px] text-primary shrink-0" />
                                    <span className="text-xs font-bold text-on-surface truncate">
                                        {user?.name}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleStartEditName}
                                        className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-0.5 ml-1 cursor-pointer"
                                        title="Change display name"
                                    >
                                        <AppIcon name="edit" className="text-[12px]" />
                                        <span>Edit Name</span>
                                    </button>
                                    <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-mono uppercase font-bold">
                                        {user?.authProvider}
                                    </span>
                                </div>
                                {user?.email && (
                                    <p className="text-[10px] text-on-surface-variant truncate">
                                        {user.email}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={logoutUser}
                                className="px-2.5 h-8 rounded-lg border border-outline-variant/30 text-[11px] font-semibold text-on-surface-variant hover:text-error hover:border-error/30 cursor-pointer shrink-0"
                            >
                                Sign Out
                            </button>
                        </div>

                        {/* Inline Display Name Edit Form */}
                        {isEditingDisplayName && (
                            <form
                                onSubmit={handleSaveDisplayName}
                                className="rounded-2xl bg-surface-container border border-outline-variant/35 p-3 space-y-2.5 animate-in fade-in duration-150"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                                        <AppIcon name="badge" className="text-[15px] text-primary" />
                                        <span>Update Your Display Name</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditingDisplayName(false)}
                                        className="text-[11px] text-on-surface-variant hover:text-on-surface cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                </div>
                                <div>
                                    <input
                                        type="text"
                                        value={displayNameDraft}
                                        onChange={(e) => setDisplayNameDraft(e.target.value)}
                                        placeholder="Enter your name (e.g. Niraj)"
                                        maxLength={60}
                                        className="w-full h-9 px-3 rounded-xl bg-surface-container-low border border-outline-variant/35 text-xs text-on-surface focus:outline-none focus:border-primary"
                                        autoFocus
                                    />
                                    {displayNameError && (
                                        <p className="text-[11px] text-error mt-1">{displayNameError}</p>
                                    )}
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditingDisplayName(false)}
                                        className="px-3 h-8 rounded-xl border border-outline-variant/30 text-xs font-medium text-on-surface-variant hover:bg-surface-container-low cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={updateProfileMutation.isPending}
                                        className="px-3.5 h-8 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 cursor-pointer flex items-center gap-1.5 disabled:opacity-60 shadow-xs"
                                    >
                                        {updateProfileMutation.isPending && (
                                            <AppIcon name="progress_activity" className="text-[13px] animate-spin" />
                                        )}
                                        <span>{updateProfileMutation.isPending ? 'Saving...' : 'Save Name'}</span>
                                    </button>
                                </div>
                            </form>
                        )}

                        {roomError && (
                            <div className="p-3 rounded-xl bg-error/10 border border-error/25 text-xs text-error flex items-start gap-2">
                                <AppIcon name="error" className="text-[16px] shrink-0 mt-0.5" />
                                <span>{roomError}</span>
                            </div>
                        )}

                        {pendingInviteCode && preview ? (
                            /* JOIN INVITED GROUP PROMPT */
                            <form
                                onSubmit={handleConfirmJoinInvitedRoom}
                                className="rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm p-4 space-y-4"
                            >
                                <div>
                                    <h3 className="text-base font-bold text-on-surface font-headline">
                                        Join &quot;{preview.name}&quot;
                                    </h3>
                                    <p className="text-xs text-on-surface-variant mt-0.5">
                                        Choose whether to join with your name or link to an existing member slot in this room.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label
                                        className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-colors ${
                                            effectiveJoinLinkSlot === '__new__'
                                                ? 'bg-primary/8 border-primary/40'
                                                : 'bg-surface-container-low border-outline-variant/25'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="join-slot"
                                            checked={effectiveJoinLinkSlot === '__new__'}
                                            onChange={() => setSelectedLinkSlot('__new__')}
                                            className="accent-primary"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <span className="text-xs font-bold text-on-surface block">
                                                Join as {customJoinName.trim() || user?.name}
                                            </span>
                                            <span className="text-[11px] text-on-surface-variant">
                                                Adds you as a new member in this room
                                            </span>
                                        </div>
                                    </label>

                                    {effectiveJoinLinkSlot === '__new__' && (
                                        <input
                                            type="text"
                                            value={customJoinName}
                                            onChange={(e) => setCustomJoinName(e.target.value)}
                                            placeholder={`Display name in room (default: ${user?.name || ''})`}
                                            className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant/35 text-xs text-on-surface focus:outline-none focus:border-primary"
                                        />
                                    )}

                                    {preview.unclaimedMembers.map((slot) => (
                                        <label
                                            key={slot.memberId}
                                            className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-colors ${
                                                effectiveJoinLinkSlot === slot.name
                                                    ? 'bg-primary/8 border-primary/40'
                                                    : 'bg-surface-container-low border-outline-variant/25'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="join-slot"
                                                checked={effectiveJoinLinkSlot === slot.name}
                                                onChange={() => setSelectedLinkSlot(slot.name)}
                                                className="accent-primary"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <span className="text-xs font-bold text-on-surface block">
                                                    Link to &quot;{slot.name}&quot;
                                                </span>
                                                <span className="text-[11px] text-on-surface-variant">
                                                    Pre-added unclaimed slot{' '}
                                                    {slot.upiId ? `• ${slot.upiId}` : ''}
                                                </span>
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-on-surface-variant">
                                        UPI ID for this room (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={joinUpiInput}
                                        onChange={(e) => setJoinUpiInput(e.target.value)}
                                        placeholder={user?.upiId || 'name@okbank'}
                                        className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant/35 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                                    />
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPendingInviteCode(null);
                                            setRoomError(null);
                                        }}
                                        className="h-11 px-4 rounded-xl border border-outline-variant/40 text-xs font-semibold text-on-surface hover:bg-surface-container cursor-pointer"
                                    >
                                        Skip
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={joinGroupMutation.isPending}
                                        className="flex-1 h-11 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary/90 cursor-pointer disabled:opacity-60 shadow-xs"
                                    >
                                        {joinGroupMutation.isPending ? 'Joining...' : 'Join Room'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            /* CREATE OR JOIN ROOM CARD */
                            <div className="rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-surface-container-low border border-outline-variant/25">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRoomAction('create');
                                            setRoomError(null);
                                        }}
                                        className={`h-9 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                            roomAction === 'create'
                                                ? 'bg-surface-container-lowest text-primary shadow-xs'
                                                : 'text-on-surface-variant hover:text-on-surface'
                                        }`}
                                    >
                                        <AppIcon name="add_circle" className="text-[16px]" />
                                        <span>Create Room</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRoomAction('join');
                                            setRoomError(null);
                                        }}
                                        className={`h-9 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                            roomAction === 'join'
                                                ? 'bg-surface-container-lowest text-primary shadow-xs'
                                                : 'text-on-surface-variant hover:text-on-surface'
                                        }`}
                                    >
                                        <AppIcon name="qr_code_scanner" className="text-[16px]" />
                                        <span>Join Room</span>
                                    </button>
                                </div>

                                {roomAction === 'create' ? (
                                    <form onSubmit={handleCreateRoom} className="space-y-3.5">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-semibold text-on-surface-variant">
                                                Room / Trip Name
                                            </label>
                                            <input
                                                type="text"
                                                value={roomName}
                                                onChange={(e) => setRoomName(e.target.value)}
                                                placeholder="e.g. Goa Trip or Flat 402"
                                                required
                                                className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[11px] font-semibold text-on-surface-variant">
                                                Subtitle (optional)
                                            </label>
                                            <input
                                                type="text"
                                                value={roomSubtitle}
                                                onChange={(e) => setRoomSubtitle(e.target.value)}
                                                placeholder="e.g. Weekend Getaway Expenses"
                                                className="w-full h-10 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface focus:outline-none focus:border-primary"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-on-surface-variant block">
                                                Room Icon
                                            </label>
                                            <div className="grid grid-cols-4 gap-2">
                                                {ROOM_ICONS.map((ic) => (
                                                    <button
                                                        key={ic.id}
                                                        type="button"
                                                        onClick={() => setRoomIcon(ic.id)}
                                                        className={`py-2 px-1 rounded-xl border text-[10px] font-semibold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                                                            roomIcon === ic.id
                                                                ? 'bg-primary/12 border-primary text-primary'
                                                                : 'bg-surface-container-low border-outline-variant/25 text-on-surface-variant hover:text-on-surface'
                                                        }`}
                                                    >
                                                        <AppIcon name={ic.id} className="text-[18px]" />
                                                        <span>{ic.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-on-surface-variant block">
                                                Pre-add Members (optional — others can scan your QR)
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={memberDraft}
                                                    onChange={(e) => setMemberDraft(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleAddInitialMember();
                                                        }
                                                    }}
                                                    placeholder="Add friend name..."
                                                    className="flex-1 h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface focus:outline-none focus:border-primary"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddInitialMember}
                                                    className="h-10 px-3 rounded-xl bg-surface-container border border-outline-variant/30 text-xs font-bold text-primary hover:bg-surface-container-high cursor-pointer"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                            {initialMembers.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {initialMembers.map((m) => (
                                                        <span
                                                            key={m}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold"
                                                        >
                                                            <span>{m}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setInitialMembers((prev) =>
                                                                        prev.filter((x) => x !== m)
                                                                    )
                                                                }
                                                                className="hover:text-error cursor-pointer"
                                                            >
                                                                <AppIcon name="close" className="text-[13px]" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={createGroupMutation.isPending}
                                            className="w-full h-11 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary/90 cursor-pointer disabled:opacity-60 shadow-xs"
                                        >
                                            {createGroupMutation.isPending
                                                ? 'Creating Room...'
                                                : 'Create Room & Generate Invite QR'}
                                        </button>
                                    </form>
                                ) : (
                                    <div className="space-y-3.5">
                                        <button
                                            type="button"
                                            onClick={() => setShowInviteScanner(true)}
                                            className="w-full h-12 rounded-2xl bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-2 shadow-xs hover:bg-primary/90 cursor-pointer"
                                        >
                                            <AppIcon name="qr_code_scanner" className="text-[20px]" />
                                            <span>Scan Room Invite QR / Screenshot</span>
                                        </button>

                                        <div className="relative flex items-center">
                                            <div className="flex-1 border-t border-outline-variant/25" />
                                            <span className="px-2.5 text-[10px] font-mono uppercase text-on-surface-variant">
                                                Or enter invite code
                                            </span>
                                            <div className="flex-1 border-t border-outline-variant/25" />
                                        </div>

                                        <form onSubmit={handleLookupCodeSubmit} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={joinCodeInput}
                                                onChange={(e) => setJoinCodeInput(e.target.value)}
                                                placeholder="Paste code or invite URL..."
                                                className="flex-1 h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                                            />
                                            <button
                                                type="submit"
                                                className="h-11 px-4 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-primary text-xs font-bold border border-outline-variant/30 cursor-pointer"
                                            >
                                                Find
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Existing Rooms quick jump if user already belongs to rooms */}
                        {groups.length > 0 && (
                            <div className="rounded-2xl bg-surface-container-low border border-outline-variant/25 p-3.5 space-y-2">
                                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-on-surface-variant block">
                                    Your Existing Rooms
                                </span>
                                <div className="space-y-1.5">
                                    {groups.map((g) => (
                                        <button
                                            key={g.groupId}
                                            type="button"
                                            onClick={() => {
                                                setPendingInviteCode(null);
                                                setActiveGroupId(g.groupId);
                                                setActiveTab('dashboard');
                                            }}
                                            className="w-full p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/25 hover:border-primary/40 flex items-center justify-between gap-2 text-left cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                    <AppIcon name={g.icon || 'groups'} className="text-[18px]" />
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="text-xs font-bold text-on-surface block truncate">
                                                        {g.name}
                                                    </span>
                                                    <span className="text-[10px] text-on-surface-variant block truncate">
                                                        {g.memberCount} members • Joined as {g.myMemberName}
                                                    </span>
                                                </div>
                                            </div>
                                            <AppIcon name="arrow_forward" className="text-[16px] text-primary shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Past Rooms quick jump for former members retaining historical financial records */}
                        {formerGroups.length > 0 && (
                            <div className="rounded-2xl bg-surface-container-low border border-outline-variant/25 p-3.5 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                                        <AppIcon name="schedule" className="text-[14px] text-primary" />
                                        <span>Past Rooms (Read-Only History)</span>
                                    </span>
                                    <span className="text-[10px] text-on-surface-variant">
                                        Archived records
                                    </span>
                                </div>
                                <div className="space-y-1.5">
                                    {formerGroups.map((g) => (
                                        <button
                                            key={g.groupId}
                                            type="button"
                                            onClick={() => {
                                                setPendingInviteCode(null);
                                                setActiveGroupId(g.groupId);
                                                setActiveTab('dashboard');
                                            }}
                                            className="w-full p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/25 hover:border-primary/40 flex items-center justify-between gap-2 text-left cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-surface-container text-on-surface-variant flex items-center justify-center shrink-0">
                                                    <AppIcon name={g.icon || 'groups'} className="text-[18px]" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-bold text-on-surface block truncate">
                                                            {g.name}
                                                        </span>
                                                        <span className="px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface-variant text-[9px] font-bold uppercase shrink-0">
                                                            Read-Only
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-on-surface-variant block truncate">
                                                        As {g.myMemberName || user?.name} •{' '}
                                                        {g.leftReason === 'REMOVED'
                                                            ? 'Removed by owner'
                                                            : 'Left room'}
                                                    </span>
                                                </div>
                                            </div>
                                            <AppIcon name="arrow_forward" className="text-[16px] text-primary shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer Admin Access Link */}
            <div className="text-center pt-2">
                <button
                    type="button"
                    onClick={() => setActiveTab('admin')}
                    className="inline-flex items-center gap-1.5 text-[11px] text-on-surface-variant hover:text-primary font-medium cursor-pointer"
                >
                    <AppIcon name="admin_panel_settings" className="text-[14px]" />
                    <span>Admin Console</span>
                </button>
            </div>

            <Suspense fallback={null}>
                <QrScannerModal
                    isOpen={showInviteScanner}
                    onClose={() => setShowInviteScanner(false)}
                    mode="invite"
                    onScanInvite={(code) => {
                        setShowInviteScanner(false);
                        setSelectedLinkSlot('__new__');
                        setPendingInviteCode(code);
                        showToast(`Loaded invite ${code}`, 'qr_code_scanner');
                    }}
                />
            </Suspense>
        </div>
    );
};

export default OnboardingScreen;

