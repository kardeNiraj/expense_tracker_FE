import React, { useMemo, useState } from 'react';
import { useExpense } from '../../context';
import { useGroupInvitePreview, useJoinGroupMutation, ApiError } from '../../api';
import { AppIcon } from '../Icon/AppIcon';
import { triggerHaptic } from '../../utils/haptics';

export const JoinRoomModal: React.FC = () => {
    const {
        user,
        isAuthenticated,
        pendingInviteCode,
        setPendingInviteCode,
        onJoinedOrCreatedGroup,
        showToast,
    } = useExpense();

    const [selectedSlot, setSelectedSlot] = useState<string>('__new__');
    const [customName, setCustomName] = useState<string>('');
    const [upiId, setUpiId] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const invitePreviewQuery = useGroupInvitePreview(pendingInviteCode);
    const joinMutation = useJoinGroupMutation();

    const preview = invitePreviewQuery.data;

    const effectiveSlot = useMemo(() => {
        if (!preview || !user) return '__new__';
        if (selectedSlot !== '__new__') return selectedSlot;
        const autoMatch = preview.unclaimedMembers.find(
            (m) => m.name.trim().toLowerCase() === user.name.trim().toLowerCase()
        );
        return autoMatch ? autoMatch.name : '__new__';
    }, [preview, selectedSlot, user]);

    if (!isAuthenticated || !pendingInviteCode) {
        return null;
    }

    const handleClose = () => {
        setError(null);
        setPendingInviteCode(null);
    };

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pendingInviteCode) return;
        setError(null);

        try {
            const linkMemberName = effectiveSlot !== '__new__' ? effectiveSlot : undefined;
            const displayName =
                effectiveSlot === '__new__' && customName.trim()
                    ? customName.trim()
                    : undefined;

            const res = await joinMutation.mutateAsync({
                inviteCode: pendingInviteCode,
                ...(linkMemberName ? { linkMemberName } : {}),
                ...(displayName ? { displayName } : {}),
                ...(upiId.trim() ? { upiId: upiId.trim() } : {}),
            });

            triggerHaptic('success');
            showToast(
                res.alreadyMember
                    ? `Switched to "${res.group.name}"`
                    : `Joined "${res.group.name}" as ${res.joinedAs}!`,
                'check_circle'
            );
            onJoinedOrCreatedGroup(res.group);
            setPendingInviteCode(null);
        } catch (err) {
            triggerHaptic('warning');
            setError(
                err instanceof ApiError ? err.message : 'Failed to join room. Please try again.'
            );
        }
    };

    return (
        <div className="fixed inset-0 z-70 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            {/* Backdrop */}
            <div className="fixed inset-0" onClick={handleClose} aria-hidden="true" />

            {/* Bottom Sheet Card */}
            <div className="relative z-10 w-full max-w-sm max-h-[92vh] overflow-y-auto bg-surface-container-lowest border-t sm:border border-outline-variant/30 rounded-t-3xl sm:rounded-3xl p-5 pb-safe shadow-2xl space-y-4 text-on-surface animate-in slide-in-from-bottom duration-250">
                <div className="w-12 h-1 bg-outline-variant/40 rounded-full mx-auto -mt-1 mb-1 sm:hidden" />

                {/* Header */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-outline-variant/20">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-primary/12 text-primary flex items-center justify-center shrink-0 shadow-2xs">
                            <AppIcon name={preview?.icon || 'groups'} className="text-[22px]" />
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
                                      : 'Join Room'}
                            </h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer shrink-0"
                        title="Dismiss invite"
                    >
                        <AppIcon name="close" className="text-[18px]" />
                    </button>
                </div>

                {invitePreviewQuery.isLoading && (
                    <div className="py-6 flex flex-col items-center justify-center gap-2 text-center">
                        <AppIcon name="progress_activity" className="text-[24px] text-primary animate-spin" />
                        <p className="text-xs text-on-surface-variant">Looking up room details...</p>
                    </div>
                )}

                {invitePreviewQuery.isError && (
                    <div className="py-4 space-y-3 text-center">
                        <div className="w-10 h-10 rounded-full bg-error/10 text-error flex items-center justify-center mx-auto">
                            <AppIcon name="error" className="text-[20px]" />
                        </div>
                        <p className="text-xs text-error font-medium">
                            Invite code &quot;{pendingInviteCode}&quot; was not found or has expired.
                        </p>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="w-full h-10 rounded-xl bg-surface-container text-on-surface text-xs font-semibold cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                )}

                {preview && (
                    <form onSubmit={handleJoin} className="space-y-4">
                        <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between text-xs">
                            <span className="text-on-surface-variant">Hosted by</span>
                            <span className="font-bold text-on-surface">
                                {preview.createdByName || 'Host'} • {preview.memberCount}{' '}
                                {preview.memberCount === 1 ? 'member' : 'members'}
                            </span>
                        </div>

                        {error && (
                            <div className="p-3 rounded-xl bg-error/10 border border-error/25 text-xs text-error flex items-start gap-2">
                                <AppIcon name="error" className="text-[16px] shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-2">
                            <span className="text-[11px] font-semibold text-on-surface-variant block">
                                Choose how you want to join:
                            </span>

                            {/* Option 1: New Member */}
                            <label
                                className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-colors ${
                                    effectiveSlot === '__new__'
                                        ? 'bg-primary/8 border-primary/40'
                                        : 'bg-surface-container-low border-outline-variant/25'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="join-slot-modal"
                                    checked={effectiveSlot === '__new__'}
                                    onChange={() => setSelectedSlot('__new__')}
                                    className="accent-primary"
                                />
                                <div className="min-w-0 flex-1">
                                    <span className="text-xs font-bold text-on-surface block">
                                        Join as {customName.trim() || user?.name}
                                    </span>
                                    <span className="text-[11px] text-on-surface-variant">
                                        Adds you as a member with your profile name
                                    </span>
                                </div>
                            </label>

                            {effectiveSlot === '__new__' && (
                                <input
                                    type="text"
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value)}
                                    placeholder={`Display name in room (default: ${user?.name || ''})`}
                                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant/35 text-xs text-on-surface focus:outline-none focus:border-primary"
                                />
                            )}

                            {/* Option 2: Link to existing unclaimed member */}
                            {preview.unclaimedMembers.map((slot) => (
                                <label
                                    key={slot.memberId}
                                    className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-colors ${
                                        effectiveSlot === slot.name
                                            ? 'bg-primary/8 border-primary/40'
                                            : 'bg-surface-container-low border-outline-variant/25'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="join-slot-modal"
                                        checked={effectiveSlot === slot.name}
                                        onChange={() => setSelectedSlot(slot.name)}
                                        className="accent-primary"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <span className="text-xs font-bold text-on-surface block">
                                            Link to &quot;{slot.name}&quot;
                                        </span>
                                        <span className="text-[11px] text-on-surface-variant">
                                            Pre-added member slot {slot.upiId ? `• ${slot.upiId}` : ''}
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
                                value={upiId}
                                onChange={(e) => setUpiId(e.target.value)}
                                placeholder={user?.upiId || 'name@okhdfcbank'}
                                className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant/35 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                            />
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="h-11 px-4 rounded-xl border border-outline-variant/40 text-xs font-semibold text-on-surface hover:bg-surface-container cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={joinMutation.isPending}
                                className="flex-1 h-11 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 cursor-pointer disabled:opacity-60 shadow-xs flex items-center justify-center gap-1.5"
                            >
                                {joinMutation.isPending ? (
                                    <>
                                        <AppIcon name="progress_activity" className="text-[14px] animate-spin" />
                                        <span>Joining...</span>
                                    </>
                                ) : (
                                    <>
                                        <AppIcon name="group_add" className="text-[16px]" />
                                        <span>Join Room</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default JoinRoomModal;
