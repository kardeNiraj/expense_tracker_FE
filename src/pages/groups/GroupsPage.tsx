import React, { lazy, Suspense, useMemo, useState } from 'react';
import { useExpense } from '../../context';
import {
    ApiError,
    useAddGroupMemberMutation,
    useCreateGroupInviteMutation,
    useCreateGroupMutation,
    useGroupInvitePreview,
    useGroupInvites,
    useJoinGroupMutation,
    useLeaveGroupMutation,
    useRemoveGroupMemberMutation,
    useRevokeGroupInviteMutation,
    useUpdateGroupMutation,
    type CreateGroupInviteResponse,
    type GroupInviteToken,
} from '../../api';
import { AppIcon, Avatar, QRCode, RoomStatusBadge, RoomLifecycleActions } from '../../components';
import { triggerHaptic } from '../../utils/haptics';
import { buildGroupInviteUrl, parseGroupInviteCode } from '../../utils/qr';

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

export const GroupsPage: React.FC = () => {
    const {
        user,
        groups,
        formerGroups,
        activeGroup,
        activeGroupId,
        isFormerActiveGroup,
        setActiveGroupId,
        onJoinedOrCreatedGroup,
        refreshAuthAndGroups,
        setActiveTab,
        showToast,
    } = useExpense();

    // Modals / Sheets
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showInviteScanner, setShowInviteScanner] = useState(false);
    const [showEditRoomModal, setShowEditRoomModal] = useState(false);
    const [confirmLeaveGroupId, setConfirmLeaveGroupId] = useState<string | null>(null);
    const [confirmRemoveMember, setConfirmRemoveMember] = useState<{
        memberName: string;
        isClaimed: boolean;
    } | null>(null);

    // Create Room State
    const [newName, setNewName] = useState('');
    const [newSubtitle, setNewSubtitle] = useState('');
    const [newIcon, setNewIcon] = useState<string>('groups');
    const [memberDraft, setMemberDraft] = useState('');
    const [initialMembers, setInitialMembers] = useState<string[]>([]);

    // Join Room State
    const [joinInput, setJoinInput] = useState('');
    const [lookupCode, setLookupCode] = useState<string | null>(null);
    const [selectedJoinSlot, setSelectedJoinSlot] = useState<string>('__new__');
    const [customJoinName, setCustomJoinName] = useState('');
    const [joinUpiInput, setJoinUpiInput] = useState('');

    // Active Room Edit / Member Pre-add State
    const [editName, setEditName] = useState('');
    const [editSubtitle, setEditSubtitle] = useState('');
    const [editIcon, setEditIcon] = useState('groups');
    const [addMemberName, setAddMemberName] = useState('');
    const [addMemberUpi, setAddMemberUpi] = useState('');
    const [copiedType, setCopiedType] = useState<string | null>(null);

    // Revocable Invite Tokens State
    const [showTokensPanel, setShowTokensPanel] = useState(false);
    const [tokenLabel, setTokenLabel] = useState('');
    const [tokenMaxUses, setTokenMaxUses] = useState<string>('0');
    const [tokenExpiryHours, setTokenExpiryHours] = useState<string>('24');
    const [createdTokenResult, setCreatedTokenResult] = useState<CreateGroupInviteResponse | null>(
        null
    );

    // Lifecycle Status Filter
    const [roomStatusFilter, setRoomStatusFilter] = useState<
        'ALL' | 'ACTIVE' | 'ARCHIVED' | 'CLOSED'
    >('ALL');

    const statusCounts = useMemo(() => {
        const counts = { ALL: groups.length, ACTIVE: 0, ARCHIVED: 0, CLOSED: 0 };
        for (const g of groups) {
            const st = (g.status || 'ACTIVE').toUpperCase() as 'ACTIVE' | 'ARCHIVED' | 'CLOSED';
            if (st in counts) counts[st]++;
            else counts.ACTIVE++;
        }
        return counts;
    }, [groups]);

    const displayedGroups = useMemo(() => {
        if (roomStatusFilter === 'ALL') return groups;
        return groups.filter((g) => {
            const st = (g.status || 'ACTIVE').toUpperCase();
            return st === roomStatusFilter;
        });
    }, [groups, roomStatusFilter]);

    const invitePreviewQuery = useGroupInvitePreview(lookupCode);
    const groupInvitesQuery = useGroupInvites(
        activeGroup?.groupId,
        Boolean(activeGroup?.isOwner && !isFormerActiveGroup && showTokensPanel)
    );
    const createMutation = useCreateGroupMutation();
    const joinMutation = useJoinGroupMutation();
    const updateMutation = useUpdateGroupMutation();
    const addMemberMutation = useAddGroupMemberMutation();
    const removeMemberMutation = useRemoveGroupMemberMutation();
    const leaveMutation = useLeaveGroupMutation();
    const createInviteMutation = useCreateGroupInviteMutation();
    const revokeInviteMutation = useRevokeGroupInviteMutation();

    const inviteUrl = activeGroup?.inviteCode
        ? buildGroupInviteUrl(activeGroup.inviteCode)
        : '';

    const preview = invitePreviewQuery.data;
    const effectiveJoinSlot = useMemo(() => {
        if (!preview || !user) return '__new__';
        if (selectedJoinSlot !== '__new__') return selectedJoinSlot;
        const autoMatch = preview.unclaimedMembers.find(
            (m) => m.name.trim().toLowerCase() === user.name.trim().toLowerCase()
        );
        return autoMatch ? autoMatch.name : '__new__';
    }, [preview, selectedJoinSlot, user]);

    const handleCopy = async (text: string, type: string) => {
        try {
            await navigator.clipboard.writeText(text);
            triggerHaptic('success');
            setCopiedType(type);
            showToast(
                type === 'code' || type === 'token_code'
                    ? `Invite code ${text} copied!`
                    : 'Invite link copied!',
                'content_copy'
            );
            setTimeout(() => setCopiedType(null), 2200);
        } catch {
            showToast('Failed to copy to clipboard', 'error');
        }
    };

    const handleWhatsAppShare = (customUrl?: string, customCode?: string) => {
        if (!activeGroup) return;
        const urlToShare = customUrl || inviteUrl;
        const codeToShare = customCode || activeGroup.roomCode || activeGroup.inviteCode;
        if (!urlToShare) return;
        triggerHaptic('light');
        const msg = `Hey! Join "${activeGroup.name}" on SplitNest to track & split bills:\n👉 ${urlToShare}${
            codeToShare ? `\nRoom Code: ${codeToShare}` : ''
        }`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const handleRotateInvite = async () => {
        if (!activeGroup || !activeGroup.isOwner || isFormerActiveGroup) return;
        try {
            await updateMutation.mutateAsync({
                groupId: activeGroup.groupId,
                regenerateInviteCode: true,
            });
            triggerHaptic('success');
            showToast('Generated a fresh primary invite QR & code!', 'refresh');
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : 'Failed to rotate invite code', 'error');
        }
    };

    const handleCreateRevocableInvite = async (
        e?: React.FormEvent,
        options?: { setAsPrimary?: boolean }
    ) => {
        e?.preventDefault();
        if (!activeGroup || !activeGroup.isOwner || isFormerActiveGroup) return;
        try {
            const parsedMaxUses = Number(tokenMaxUses);
            const parsedExpiry = Number(tokenExpiryHours);
            const res = await createInviteMutation.mutateAsync({
                groupId: activeGroup.groupId,
                ...(options?.setAsPrimary ? { setAsPrimary: true } : {}),
                ...(tokenLabel.trim() && !options?.setAsPrimary
                    ? { label: tokenLabel.trim() }
                    : {}),
                ...(parsedMaxUses > 0 && !options?.setAsPrimary
                    ? { maxUses: parsedMaxUses }
                    : {}),
                ...(parsedExpiry > 0 && !options?.setAsPrimary
                    ? { expiresInHours: parsedExpiry }
                    : {}),
            });
            triggerHaptic('success');
            setCreatedTokenResult(res);
            if (!options?.setAsPrimary) {
                setTokenLabel('');
                setShowTokensPanel(true);
                showToast('Created secure revocable invite link!', 'qr_code_2');
            } else {
                showToast('Generated new primary invite QR!', 'refresh');
            }
        } catch (err) {
            showToast(
                err instanceof ApiError ? err.message : 'Failed to create invite token',
                'error'
            );
        }
    };

    const handleRevokeInvite = async (invite: GroupInviteToken) => {
        if (!activeGroup || !activeGroup.isOwner || isFormerActiveGroup) return;
        try {
            await revokeInviteMutation.mutateAsync({
                groupId: activeGroup.groupId,
                inviteId: invite.inviteId,
            });
            triggerHaptic('medium');
            if (createdTokenResult?.invite.inviteId === invite.inviteId) {
                setCreatedTokenResult(null);
            }
            showToast(`Revoked "${invite.label || 'invite token'}"`);
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : 'Failed to revoke invite', 'error');
        }
    };

    const openEditRoom = () => {
        if (!activeGroup || isFormerActiveGroup) return;
        setEditName(activeGroup.name);
        setEditSubtitle(activeGroup.subtitle || '');
        setEditIcon(activeGroup.icon || 'groups');
        setShowEditRoomModal(true);
    };

    const handleSaveRoomEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeGroup || !editName.trim() || isFormerActiveGroup) return;
        try {
            await updateMutation.mutateAsync({
                groupId: activeGroup.groupId,
                name: editName.trim(),
                subtitle: editSubtitle.trim(),
                icon: editIcon,
            });
            triggerHaptic('success');
            showToast('Room details updated!');
            setShowEditRoomModal(false);
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : 'Could not update room', 'error');
        }
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeGroup || !addMemberName.trim() || isFormerActiveGroup) return;
        try {
            await addMemberMutation.mutateAsync({
                groupId: activeGroup.groupId,
                name: addMemberName.trim(),
                ...(addMemberUpi.trim() ? { upiId: addMemberUpi.trim() } : {}),
            });
            triggerHaptic('success');
            showToast(`Added ${addMemberName.trim()} to ${activeGroup.name}`);
            setAddMemberName('');
            setAddMemberUpi('');
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : 'Could not add member', 'error');
        }
    };

    const handleConfirmRemoveMember = async () => {
        if (!activeGroup || !confirmRemoveMember) return;
        const { memberName } = confirmRemoveMember;
        try {
            await removeMemberMutation.mutateAsync({
                groupId: activeGroup.groupId,
                memberName,
            });
            setConfirmRemoveMember(null);
            triggerHaptic('medium');
            showToast(`Removed ${memberName} from room`);
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : 'Could not remove member', 'error');
        }
    };

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newName.trim().length < 2) {
            showToast('Room name must be at least 2 characters', 'warning');
            return;
        }
        try {
            const created = await createMutation.mutateAsync({
                name: newName.trim(),
                ...(newSubtitle.trim() ? { subtitle: newSubtitle.trim() } : {}),
                icon: newIcon,
                initialMembers,
            });
            triggerHaptic('success');
            setShowCreateModal(false);
            setNewName('');
            setNewSubtitle('');
            setInitialMembers([]);
            setCreatedTokenResult(null);
            onJoinedOrCreatedGroup(created);
            showToast(`Created room "${created.name}"!`, 'check_circle');
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : 'Failed to create room', 'error');
        }
    };

    const handleLookupJoin = (e: React.FormEvent) => {
        e.preventDefault();
        const code = parseGroupInviteCode(joinInput);
        if (!code) {
            showToast('Enter a valid invite code or link', 'warning');
            return;
        }
        setSelectedJoinSlot('__new__');
        setLookupCode(code);
    };

    const handleJoinRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lookupCode) return;
        try {
            const linkMemberName = effectiveJoinSlot !== '__new__' ? effectiveJoinSlot : undefined;
            const displayName =
                effectiveJoinSlot === '__new__' && customJoinName.trim()
                    ? customJoinName.trim()
                    : undefined;
            const res = await joinMutation.mutateAsync({
                inviteCode: lookupCode,
                ...(linkMemberName ? { linkMemberName } : {}),
                ...(displayName ? { displayName } : {}),
                ...(joinUpiInput.trim() ? { upiId: joinUpiInput.trim() } : {}),
            });
            triggerHaptic('success');
            setShowJoinModal(false);
            setJoinInput('');
            setLookupCode(null);
            setCustomJoinName('');
            setCreatedTokenResult(null);
            onJoinedOrCreatedGroup(res.group);
            showToast(`Joined "${res.group.name}" as ${res.joinedAs}!`, 'check_circle');
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : 'Could not join room', 'error');
        }
    };

    const handleConfirmLeave = async () => {
        if (!confirmLeaveGroupId) return;
        const targetId = confirmLeaveGroupId;
        try {
            await leaveMutation.mutateAsync(targetId);
            setConfirmLeaveGroupId(null);
            await refreshAuthAndGroups();
            const remaining = groups.filter((g) => g.groupId !== targetId);
            setActiveGroupId(remaining[0]?.groupId || null);
            triggerHaptic('medium');
            showToast('Left room — historical records retained under Past Rooms');
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : 'Failed to leave room', 'error');
        }
    };

    return (
        <div className="flex flex-col w-full pb-12 space-y-5">
            {/* Page Header */}
            <div className="flex items-center justify-between gap-2 pt-1">
                <div>
                    <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline">
                        Rooms &amp; Invites
                    </h1>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                        Switch groups, share QR codes, and manage members
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className="h-9 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-xs font-semibold text-on-surface flex items-center gap-1 cursor-pointer shrink-0"
                >
                    <AppIcon name="arrow_back" className="text-[16px]" />
                    <span>Overview</span>
                </button>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
                <button
                    type="button"
                    onClick={() => {
                        triggerHaptic('light');
                        setShowCreateModal(true);
                    }}
                    className="h-11 px-3 rounded-2xl bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs hover:bg-primary/90 cursor-pointer"
                >
                    <AppIcon name="add_circle" className="text-[18px]" />
                    <span>New Room</span>
                </button>
                <button
                    type="button"
                    onClick={() => {
                        triggerHaptic('light');
                        setLookupCode(null);
                        setJoinInput('');
                        setShowJoinModal(true);
                    }}
                    className="h-11 px-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/35 hover:border-primary/40 text-on-surface text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                    <AppIcon name="qr_code_scanner" className="text-[18px] text-primary" />
                    <span>Join via QR / Code</span>
                </button>
            </div>

            {/* Your Rooms List */}
            <div className="space-y-2.5">
                <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-on-surface-variant">
                        Your Rooms ({groups.length})
                    </span>
                </div>

                {/* Status Filter Tabs */}
                {groups.length > 0 && (
                    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-container-low border border-outline-variant/20 overflow-x-auto no-scrollbar">
                        {(['ALL', 'ACTIVE', 'ARCHIVED', 'CLOSED'] as const).map((tab) => {
                            const count = statusCounts[tab];
                            const isSelected = roomStatusFilter === tab;
                            return (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic('selection');
                                        setRoomStatusFilter(tab);
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                                        isSelected
                                            ? 'bg-primary text-on-primary shadow-xs'
                                            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                                    }`}
                                >
                                    <span>
                                        {tab === 'ALL'
                                            ? 'All'
                                            : tab.charAt(0) + tab.slice(1).toLowerCase()}
                                    </span>
                                    <span
                                        className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                            isSelected
                                                ? 'bg-on-primary/20 text-on-primary'
                                                : 'bg-surface-container-high text-on-surface-variant'
                                        }`}
                                    >
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {groups.length === 0 && (
                    <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 text-xs text-on-surface-variant text-center">
                        You are not currently in any active room. Create or join a room above, or inspect your archived history below.
                    </div>
                )}

                {groups.length > 0 && displayedGroups.length === 0 && (
                    <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 text-xs text-on-surface-variant text-center">
                        No {roomStatusFilter.toLowerCase()} rooms found.
                    </div>
                )}

                {displayedGroups.map((g) => {
                    const isActive = g.groupId === activeGroupId;
                    const roomStatus = (g.status || 'ACTIVE').toUpperCase();
                    const isMuted = roomStatus === 'ARCHIVED' || roomStatus === 'CLOSED';

                    return (
                        <button
                            key={g.groupId}
                            type="button"
                            onClick={() => {
                                triggerHaptic('light');
                                setCreatedTokenResult(null);
                                setActiveGroupId(g.groupId);
                                showToast(`Switched to "${g.name}"`, g.icon || 'groups');
                            }}
                            className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                                isActive
                                    ? 'bg-primary/8 border-primary/45 shadow-xs'
                                    : isMuted
                                      ? 'bg-surface-container-lowest/60 border-outline-variant/25 opacity-85 hover:opacity-100 hover:border-outline-variant/60'
                                      : 'bg-surface-container-lowest border-outline-variant/30 hover:border-outline-variant/60'
                            }`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div
                                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                                        isActive
                                            ? 'bg-primary text-on-primary'
                                            : isMuted
                                              ? 'bg-surface-container-high text-on-surface-variant'
                                              : 'bg-surface-container text-primary'
                                    }`}
                                >
                                    <AppIcon name={g.icon || 'groups'} className="text-[22px]" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-sm text-on-surface truncate">
                                            {g.name}
                                        </span>
                                        {isActive && (
                                            <span className="px-1.5 py-0.5 rounded-md bg-primary text-on-primary text-[9px] font-bold uppercase">
                                                Selected
                                            </span>
                                        )}
                                        <RoomStatusBadge status={roomStatus} size="sm" />
                                        {g.isOwner && (
                                            <span className="px-1.5 py-0.5 rounded-md bg-secondary-fixed text-on-secondary-fixed text-[9px] font-bold">
                                                Owner
                                            </span>
                                        )}
                                        {!g.inviteCode && roomStatus === 'ACTIVE' && (
                                            <span className="px-1.5 py-0.5 rounded-md bg-error/10 text-error text-[9px] font-bold">
                                                QR Revoked
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[11px] text-on-surface-variant block truncate mt-0.5">
                                        {g.memberCount} members • {g.myMemberName || user?.name}
                                        {roomStatus === 'ACTIVE' && (g.roomCode || g.inviteCode) ? (
                                            <>
                                                {' '}
                                                • <code className="font-mono">{g.roomCode || g.inviteCode}</code>
                                            </>
                                        ) : null}
                                    </span>
                                </div>
                            </div>
                            <AppIcon
                                name={isActive ? 'check_circle' : 'arrow_forward'}
                                className={`text-[18px] shrink-0 ${
                                    isActive ? 'text-primary' : 'text-on-surface-variant'
                                }`}
                            />
                        </button>
                    );
                })}
            </div>

            {/* Past Rooms (Retained Historical Financial Records) */}
            {formerGroups.length > 0 && (
                <div className="space-y-2.5">
                    <div className="flex items-center justify-between px-0.5">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                            <AppIcon name="schedule" className="text-[14px] text-primary" />
                            <span>Past Rooms ({formerGroups.length})</span>
                        </span>
                        <span className="text-[10px] text-on-surface-variant">
                            Read-Only History
                        </span>
                    </div>

                    {formerGroups.map((g) => {
                        const isActive = g.groupId === activeGroupId;
                        return (
                            <button
                                key={g.groupId}
                                type="button"
                                onClick={() => {
                                    triggerHaptic('light');
                                    setCreatedTokenResult(null);
                                    setActiveGroupId(g.groupId);
                                    showToast(`Viewing archived history for "${g.name}"`, 'schedule');
                                }}
                                className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                                    isActive
                                        ? 'bg-primary/8 border-primary/45 shadow-xs'
                                        : 'bg-surface-container-low/70 border-outline-variant/30 hover:border-outline-variant/60'
                                }`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div
                                        className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                                            isActive
                                                ? 'bg-primary text-on-primary'
                                                : 'bg-surface-container text-on-surface-variant'
                                        }`}
                                    >
                                        <AppIcon name={g.icon || 'groups'} className="text-[22px]" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-bold text-sm text-on-surface truncate">
                                                {g.name}
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded-md bg-surface-container-high text-on-surface-variant text-[9px] font-bold uppercase">
                                                Read-Only Archive
                                            </span>
                                            {isActive && (
                                                <span className="px-1.5 py-0.5 rounded-md bg-primary text-on-primary text-[9px] font-bold uppercase">
                                                    Viewing
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[11px] text-on-surface-variant block truncate mt-0.5">
                                            Joined as {g.myMemberName || user?.name} •{' '}
                                            {g.leftReason === 'REMOVED' ? 'Removed' : 'Left'}
                                            {g.leftAt
                                                ? ` on ${new Date(g.leftAt).toLocaleDateString('en-IN', {
                                                      day: 'numeric',
                                                      month: 'short',
                                                      year: 'numeric',
                                                  })}`
                                                : ''}
                                        </span>
                                    </div>
                                </div>
                                <AppIcon
                                    name={isActive ? 'check_circle' : 'arrow_forward'}
                                    className={`text-[18px] shrink-0 ${
                                        isActive ? 'text-primary' : 'text-on-surface-variant'
                                    }`}
                                />
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Active Room Details, QR Invite & Members (or Historical Archive notice for former rooms) */}
            {activeGroup && isFormerActiveGroup && (
                <div className="rounded-3xl bg-surface-container-lowest border border-outline-variant/30 p-4 space-y-3 shadow-xs">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <AppIcon name="schedule" className="text-[20px]" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary block">
                                Historical Archive • Read-Only
                            </span>
                            <h2 className="text-base font-bold text-on-surface font-headline truncate">
                                {activeGroup.name}
                            </h2>
                            <p className="text-xs text-on-surface-variant leading-relaxed">
                                Your active membership ended
                                {activeGroup.leftReason === 'REMOVED'
                                    ? ' (removed by room owner)'
                                    : ''}
                                . All expenses, splits, and settlements recorded prior to{' '}
                                <strong className="text-on-surface">
                                    {activeGroup.leftAt
                                        ? new Date(activeGroup.leftAt).toLocaleString('en-IN', {
                                              day: 'numeric',
                                              month: 'short',
                                              year: 'numeric',
                                          })
                                        : 'your departure'}
                                </strong>{' '}
                                remain preserved across Overview, Splits, and Stats.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab('splits')}
                            className="flex-1 h-10 px-3 rounded-xl bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <AppIcon name="pie_chart" className="text-[16px]" />
                            <span>View Retained Splits</span>
                        </button>
                        {groups.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setActiveGroupId(groups[0].groupId)}
                                className="h-10 px-3.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-xs font-semibold text-on-surface cursor-pointer"
                            >
                                Back to Active Room
                            </button>
                        )}
                    </div>
                </div>
            )}

            {activeGroup && !isFormerActiveGroup && (
                <div className="space-y-4 pt-1">
                    {/* Room Lifecycle Status & Actions (Archive / Reactivate / Close) */}
                    <RoomLifecycleActions group={activeGroup} />

                    {/* Active Room QR Invite Card */}
                    <div className="rounded-3xl bg-surface-container-lowest border border-outline-variant/30 p-4 space-y-4 shadow-xs overflow-hidden">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary block">
                                        Room Details
                                    </span>
                                    <RoomStatusBadge
                                        status={activeGroup.status || 'ACTIVE'}
                                        size="sm"
                                    />
                                </div>
                                <h2 className="text-base font-bold text-on-surface truncate font-headline">
                                    {activeGroup.name}
                                </h2>
                                <p className="text-[11px] text-on-surface-variant truncate">
                                    {activeGroup.subtitle}
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {activeGroup.isOwner &&
                                    (activeGroup.status || 'ACTIVE').toUpperCase() !== 'CLOSED' && (
                                        <button
                                            type="button"
                                            onClick={openEditRoom}
                                            className="w-8 h-8 rounded-xl bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface cursor-pointer"
                                            title="Edit room details"
                                        >
                                            <AppIcon name="edit" className="text-[16px]" />
                                        </button>
                                    )}
                                {activeGroup.isOwner &&
                                    (activeGroup.status || 'ACTIVE').toUpperCase() === 'ACTIVE' && (
                                        <button
                                            type="button"
                                            onClick={() => void handleRotateInvite()}
                                            disabled={updateMutation.isPending}
                                            className="w-8 h-8 rounded-xl bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-primary cursor-pointer disabled:opacity-50"
                                            title="Rotate primary invite QR & code"
                                        >
                                            <AppIcon name="refresh" className="text-[16px]" />
                                        </button>
                                    )}
                            </div>
                        </div>

                        {(activeGroup.status || 'ACTIVE').toUpperCase() !== 'ACTIVE' ? (
                            <div className="rounded-2xl bg-surface-container-low border border-outline-variant/25 p-4 text-center space-y-1.5">
                                <div className="w-10 h-10 rounded-full mx-auto bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                                    <AppIcon
                                        name={
                                            (activeGroup.status || '').toUpperCase() === 'CLOSED'
                                                ? 'lock'
                                                : 'inventory_2'
                                        }
                                        className="text-xl"
                                    />
                                </div>
                                <h4 className="text-xs font-semibold text-on-surface">
                                    Invitations Disabled
                                </h4>
                                <p className="text-[11px] text-on-surface-variant max-w-xs mx-auto">
                                    This room is currently {(activeGroup.status || '').toLowerCase()}
                                    . New member invitations, QR codes, and join links are turned off.
                                </p>
                            </div>
                        ) : activeGroup.inviteCode ? (
                            <>
                                <div className="bg-surface-container/40 border border-outline-variant/25 rounded-2xl p-4 flex flex-col items-center text-center space-y-3 w-full max-w-full overflow-hidden">
                                    <div className="p-3 bg-white rounded-2xl shadow-sm border border-neutral-200">
                                        <QRCode value={inviteUrl} size={172} />
                                    </div>
                                    <div className="w-full max-w-full flex flex-col items-center text-center space-y-1.5 min-w-0">
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-lowest border border-outline-variant/30 max-w-full min-w-0 shadow-2xs">
                                            <span className="text-[10px] font-mono uppercase text-on-surface-variant font-bold shrink-0">
                                                Code
                                            </span>
                                            <span
                                                className="text-xs sm:text-sm font-mono font-bold text-primary truncate min-w-0 select-all"
                                                title={activeGroup.roomCode || activeGroup.inviteCode || ''}
                                            >
                                                {activeGroup.roomCode || activeGroup.inviteCode}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void handleCopy(
                                                        activeGroup.roomCode || activeGroup.inviteCode || '',
                                                        'code'
                                                    )
                                                }
                                                className="text-on-surface-variant hover:text-primary cursor-pointer shrink-0 p-0.5"
                                                title="Copy room code"
                                                aria-label="Copy room code"
                                            >
                                                <AppIcon
                                                    name={
                                                        copiedType === 'code'
                                                            ? 'check'
                                                            : 'content_copy'
                                                    }
                                                    className="text-[14px]"
                                                />
                                            </button>
                                        </div>
                                        <p className="text-[11px] text-on-surface-variant max-w-[260px] mx-auto text-center leading-relaxed">
                                            Friends scan this QR, enter code, or open invite link to join this room.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleWhatsAppShare()}
                                        className="h-10 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <AppIcon name="chat" className="text-[16px]" />
                                        <span>WhatsApp</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleCopy(inviteUrl, 'link')}
                                        className="h-10 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <AppIcon
                                            name={
                                                copiedType === 'link' ? 'check' : 'content_copy'
                                            }
                                            className="text-[15px] text-primary"
                                        />
                                        <span>{copiedType === 'link' ? 'Copied!' : 'Copy Link'}</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="bg-surface-container/40 border border-outline-variant/25 rounded-2xl p-4 text-center space-y-2.5">
                                <div className="w-10 h-10 rounded-xl bg-error/10 text-error flex items-center justify-center mx-auto">
                                    <AppIcon name="gpp_bad" className="text-[20px]" />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-xs font-bold text-on-surface">
                                        Primary Invite QR Revoked
                                    </p>
                                    <p className="text-[11px] text-on-surface-variant">
                                        {activeGroup.isOwner
                                            ? 'The public primary QR link has been disabled. You can generate a new one or use revocable links below.'
                                            : 'Ask the room owner to generate a new invite link.'}
                                    </p>
                                </div>
                                {activeGroup.isOwner && (
                                    <button
                                        type="button"
                                        disabled={createInviteMutation.isPending}
                                        onClick={() =>
                                            void handleCreateRevocableInvite(undefined, {
                                                setAsPrimary: true,
                                            })
                                        }
                                        className="h-9 px-3.5 rounded-xl bg-primary text-on-primary text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                    >
                                        <AppIcon name="refresh" className="text-[15px]" />
                                        <span>
                                            {createInviteMutation.isPending
                                                ? 'Generating...'
                                                : 'Generate New Primary QR'}
                                        </span>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Owner-only Revocable Invite Links & Tokens Manager */}
                        {activeGroup.isOwner &&
                            (activeGroup.status || 'ACTIVE').toUpperCase() === 'ACTIVE' && (
                                <div className="pt-2 border-t border-outline-variant/20 space-y-3">
                                <button
                                    type="button"
                                    onClick={() => setShowTokensPanel((v) => !v)}
                                    className="w-full flex items-center justify-between text-xs font-bold text-on-surface hover:text-primary cursor-pointer"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <AppIcon name="verified_user" className="text-[16px] text-primary" />
                                        <span>Revocable Invite Links &amp; Tokens</span>
                                    </span>
                                    <AppIcon
                                        name={showTokensPanel ? 'expand_less' : 'expand_more'}
                                        className="text-[18px] text-on-surface-variant"
                                    />
                                </button>

                                {showTokensPanel && (
                                    <div className="space-y-3 pt-1">
                                        {/* Create Scoped Revocable Token Form */}
                                        <form
                                            onSubmit={(e) => void handleCreateRevocableInvite(e)}
                                            className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/25 space-y-2.5"
                                        >
                                            <span className="text-[11px] font-semibold text-on-surface-variant block">
                                                Create scoped revocable token (can limit uses &amp; expiry)
                                            </span>
                                            <input
                                                type="text"
                                                value={tokenLabel}
                                                onChange={(e) => setTokenLabel(e.target.value)}
                                                placeholder="Label (e.g. Guest invite for Rahul)"
                                                className="w-full h-9 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/35 text-xs text-on-surface focus:outline-none focus:border-primary"
                                            />
                                            <div className="grid grid-cols-2 gap-2">
                                                <select
                                                    value={tokenMaxUses}
                                                    onChange={(e) => setTokenMaxUses(e.target.value)}
                                                    aria-label="Max uses"
                                                    className="h-9 px-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/35 text-xs text-on-surface"
                                                >
                                                    <option value="1">Single-use (1 guest)</option>
                                                    <option value="5">Up to 5 guests</option>
                                                    <option value="0">Unlimited uses</option>
                                                </select>
                                                <select
                                                    value={tokenExpiryHours}
                                                    onChange={(e) => setTokenExpiryHours(e.target.value)}
                                                    aria-label="Token expiry"
                                                    className="h-9 px-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/35 text-xs text-on-surface"
                                                >
                                                    <option value="1">Expires in 1h</option>
                                                    <option value="24">Expires in 24h</option>
                                                    <option value="168">Expires in 7d</option>
                                                    <option value="0">No expiry</option>
                                                </select>
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={createInviteMutation.isPending}
                                                className="w-full h-9 rounded-xl bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                            >
                                                <AppIcon name="add_circle" className="text-[15px]" />
                                                <span>
                                                    {createInviteMutation.isPending
                                                        ? 'Creating Link...'
                                                        : 'Generate Secure Invite Token'}
                                                </span>
                                            </button>
                                        </form>

                                        {/* Newly Generated Plaintext Token Card (shown immediately once created) */}
                                        {createdTokenResult && (
                                            <div className="p-3 rounded-2xl bg-primary/10 border border-primary/35 space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                                                        <AppIcon name="qr_code_2" className="text-[15px]" />
                                                        <span>
                                                            New Token Ready ({createdTokenResult.invite.label})
                                                        </span>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCreatedTokenResult(null)}
                                                        className="text-on-surface-variant hover:text-on-surface cursor-pointer"
                                                    >
                                                        <AppIcon name="close" className="text-[15px]" />
                                                    </button>
                                                </div>
                                                <code className="block p-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-[11px] font-mono break-all text-on-surface select-all">
                                                    {buildGroupInviteUrl(createdTokenResult.token)}
                                                </code>
                                                <div className="grid grid-cols-3 gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            void handleCopy(
                                                                buildGroupInviteUrl(
                                                                    createdTokenResult.token
                                                                ),
                                                                'token_link'
                                                            )
                                                        }
                                                        className="h-8 rounded-lg bg-primary text-on-primary text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                                                    >
                                                        <AppIcon
                                                            name={
                                                                copiedType === 'token_link'
                                                                    ? 'check'
                                                                    : 'content_copy'
                                                            }
                                                            className="text-[13px]"
                                                        />
                                                        <span>Link</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            void handleCopy(
                                                                createdTokenResult.token,
                                                                'token_code'
                                                            )
                                                        }
                                                        className="h-8 rounded-lg bg-surface-container-lowest border border-outline-variant/35 text-on-surface text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                                                    >
                                                        <AppIcon
                                                            name={
                                                                copiedType === 'token_code'
                                                                    ? 'check'
                                                                    : 'tag'
                                                            }
                                                            className="text-[13px]"
                                                        />
                                                        <span>Token</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleWhatsAppShare(
                                                                buildGroupInviteUrl(
                                                                    createdTokenResult.token
                                                                ),
                                                                createdTokenResult.token
                                                            )
                                                        }
                                                        className="h-8 rounded-lg bg-[#25D366] text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                                                    >
                                                        <AppIcon name="chat" className="text-[13px]" />
                                                        <span>Share</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Existing Tokens List */}
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-on-surface-variant block">
                                                Issued Invites
                                            </span>
                                            {groupInvitesQuery.isLoading ? (
                                                <p className="text-[11px] text-on-surface-variant py-2">
                                                    Loading invite tokens...
                                                </p>
                                            ) : (groupInvitesQuery.data?.length || 0) === 0 ? (
                                                <p className="text-[11px] text-on-surface-variant py-1">
                                                    No tracked invite tokens yet.
                                                </p>
                                            ) : (
                                                groupInvitesQuery.data?.map((inv) => {
                                                    const isActiveStatus = inv.status === 'ACTIVE';
                                                    return (
                                                        <div
                                                            key={inv.inviteId}
                                                            className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/25 flex items-center justify-between gap-2"
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="text-xs font-bold text-on-surface truncate">
                                                                        {inv.label || 'Invite link'}
                                                                    </span>
                                                                    {inv.isPrimary && (
                                                                        <span className="px-1.5 py-0.2 rounded bg-primary/12 text-primary text-[9px] font-bold uppercase">
                                                                            Primary
                                                                        </span>
                                                                    )}
                                                                    <span
                                                                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                                                            inv.status === 'ACTIVE'
                                                                                ? 'bg-status-settled-bg text-status-settled-text'
                                                                                : inv.status === 'REVOKED'
                                                                                  ? 'bg-error/10 text-error'
                                                                                  : 'bg-surface-container-high text-on-surface-variant'
                                                                        }`}
                                                                    >
                                                                        {inv.status}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] text-on-surface-variant block truncate mt-0.5 font-mono">
                                                                    {inv.tokenPreview} • {inv.useCount}
                                                                    {inv.maxUses
                                                                        ? `/${inv.maxUses}`
                                                                        : ''}{' '}
                                                                    used
                                                                    {inv.expiresAt
                                                                        ? ` • Exp ${new Date(
                                                                              inv.expiresAt
                                                                          ).toLocaleDateString(
                                                                              'en-IN',
                                                                              {
                                                                                  day: 'numeric',
                                                                                  month: 'short',
                                                                              }
                                                                          )}`
                                                                        : ''}
                                                                </span>
                                                            </div>
                                                            {isActiveStatus && (
                                                                <button
                                                                    type="button"
                                                                    disabled={
                                                                        revokeInviteMutation.isPending
                                                                    }
                                                                    onClick={() =>
                                                                        void handleRevokeInvite(inv)
                                                                    }
                                                                    className="h-7 px-2.5 rounded-lg border border-error/30 text-error hover:bg-error/10 text-[11px] font-bold cursor-pointer shrink-0 disabled:opacity-50"
                                                                >
                                                                    Revoke
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Room Members Card */}
                    <div className="rounded-3xl bg-surface-container-lowest border border-outline-variant/30 p-4 space-y-3.5 shadow-xs overflow-hidden">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-on-surface font-headline">
                                    Room Members ({activeGroup.members.length})
                                </h3>
                                <p className="text-[11px] text-on-surface-variant">
                                    {activeGroup.isOwner
                                        ? 'Pre-add members or remove members from this room'
                                        : 'Members in this room (room settings are managed by the owner)'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {activeGroup.members.map((member) => {
                                const isSelf =
                                    user?.userId && member.userId === user.userId;
                                const isRoomActive =
                                    (activeGroup.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
                                const canRemove =
                                    activeGroup.isOwner &&
                                    member.role !== 'OWNER' &&
                                    !isSelf &&
                                    isRoomActive;

                                return (
                                    <div
                                        key={member.memberId}
                                        className="p-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex items-center justify-between gap-2.5"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <Avatar name={member.name} size="sm" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-xs font-bold text-on-surface truncate">
                                                        {member.name}
                                                    </span>
                                                    {isSelf && (
                                                        <span className="px-1.5 py-0.5 rounded-md bg-primary/15 text-primary text-[9px] font-bold">
                                                            You
                                                        </span>
                                                    )}
                                                    {member.role === 'OWNER' && (
                                                        <span className="px-1.5 py-0.5 rounded-md bg-secondary-fixed text-on-secondary-fixed text-[9px] font-bold">
                                                            Owner
                                                        </span>
                                                    )}
                                                    {!member.isClaimed && (
                                                        <span className="px-1.5 py-0.5 rounded-md bg-tertiary-container/40 text-tertiary text-[9px] font-semibold">
                                                            Unclaimed Slot
                                                        </span>
                                                    )}
                                                </div>
                                                {member.upiId && (
                                                    <span className="text-[10px] font-mono text-on-surface-variant block truncate">
                                                        {member.upiId}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {canRemove && (
                                            <button
                                                type="button"
                                                disabled={removeMemberMutation.isPending}
                                                onClick={() =>
                                                    setConfirmRemoveMember({
                                                        memberName: member.name,
                                                        isClaimed: Boolean(member.isClaimed),
                                                    })
                                                }
                                                className="w-8 h-8 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-50"
                                                title={`Remove ${member.name}`}
                                                aria-label={`Remove ${member.name}`}
                                            >
                                                <AppIcon name="delete" className="text-[16px]" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pre-add Member Form (Owner only) */}
                        {activeGroup.isOwner &&
                        (activeGroup.status || 'ACTIVE').toUpperCase() === 'ACTIVE' ? (
                            <form
                                onSubmit={handleAddMember}
                                className="pt-2.5 border-t border-outline-variant/20 space-y-2.5"
                            >
                                <span className="text-[11px] font-semibold text-on-surface-variant block">
                                    Add / Pre-add Member Slot
                                </span>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        value={addMemberName}
                                        onChange={(e) => setAddMemberName(e.target.value)}
                                        placeholder="Member name (e.g. Priya)"
                                        required
                                        className="w-full sm:flex-1 min-w-0 h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant/35 text-xs text-on-surface focus:outline-none focus:border-primary"
                                    />
                                    <input
                                        type="text"
                                        value={addMemberUpi}
                                        onChange={(e) => setAddMemberUpi(e.target.value)}
                                        placeholder="UPI ID (optional)"
                                        className="w-full sm:w-44 min-w-0 h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant/35 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={addMemberMutation.isPending}
                                    className="w-full h-10 rounded-xl bg-primary/12 hover:bg-primary/20 text-primary text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <AppIcon name="add" className="text-[16px]" />
                                    <span>
                                        {addMemberMutation.isPending
                                            ? 'Adding...'
                                            : 'Add Member to Room'}
                                    </span>
                                </button>
                            </form>
                        ) : activeGroup.isOwner ? (
                            <div className="pt-2 border-t border-outline-variant/20 flex items-center gap-2 text-[11px] text-on-surface-variant">
                                <AppIcon
                                    name="lock"
                                    className="text-[14px] text-on-surface-variant shrink-0"
                                />
                                <span>
                                    Adding or removing members is disabled because this room is{' '}
                                    {(activeGroup.status || '').toLowerCase()}.
                                </span>
                            </div>
                        ) : (
                            <div className="pt-2 border-t border-outline-variant/20 flex items-center gap-2 text-[11px] text-on-surface-variant">
                                <AppIcon name="lock" className="text-[14px] text-primary shrink-0" />
                                <span>
                                    Only the room owner can edit room details, rotate the invite
                                    code, or manage member slots.
                                </span>
                            </div>
                        )}

                        {/* Leave Room */}
                        {(activeGroup.status || 'ACTIVE').toUpperCase() !== 'CLOSED' && (
                            <div className="pt-2 border-t border-outline-variant/20 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setConfirmLeaveGroupId(activeGroup.groupId)}
                                    className="px-3 h-9 rounded-xl border border-error/25 text-error hover:bg-error/10 text-xs font-semibold cursor-pointer"
                                >
                                    Leave Room
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create Room Modal */}
            {showCreateModal && (
                <div
                    className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs"
                    onClick={() => setShowCreateModal(false)}
                >
                    <form
                        onSubmit={handleCreateRoom}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl border border-outline-variant/30 p-5 pb-safe shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto"
                    >
                        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
                            <h3 className="text-base font-bold text-on-surface font-headline">
                                Create New Room
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center cursor-pointer"
                            >
                                <AppIcon name="close" className="text-[18px]" />
                            </button>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-on-surface-variant">
                                Room Name
                            </label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="e.g. Ladakh Roadtrip"
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
                                value={newSubtitle}
                                onChange={(e) => setNewSubtitle(e.target.value)}
                                placeholder="Expense & Splitter"
                                className="w-full h-10 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface focus:outline-none focus:border-primary"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-on-surface-variant block">
                                Icon
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {ROOM_ICONS.map((ic) => (
                                    <button
                                        key={ic.id}
                                        type="button"
                                        onClick={() => setNewIcon(ic.id)}
                                        className={`py-2 px-1 rounded-xl border text-[10px] font-semibold flex flex-col items-center gap-1 cursor-pointer ${
                                            newIcon === ic.id
                                                ? 'bg-primary/12 border-primary text-primary'
                                                : 'bg-surface-container-low border-outline-variant/25 text-on-surface-variant'
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
                                Pre-add Members (optional)
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={memberDraft}
                                    onChange={(e) => setMemberDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const clean = memberDraft.trim();
                                            if (clean && !initialMembers.includes(clean)) {
                                                setInitialMembers((p) => [...p, clean]);
                                            }
                                            setMemberDraft('');
                                        }
                                    }}
                                    placeholder="Friend name..."
                                    className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface focus:outline-none focus:border-primary"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const clean = memberDraft.trim();
                                        if (clean && !initialMembers.includes(clean)) {
                                            setInitialMembers((p) => [...p, clean]);
                                        }
                                        setMemberDraft('');
                                    }}
                                    className="h-10 px-3 rounded-xl bg-surface-container text-xs font-bold text-primary cursor-pointer shrink-0"
                                >
                                    Add
                                </button>
                            </div>
                            {initialMembers.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {initialMembers.map((m) => (
                                        <span
                                            key={m}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold"
                                        >
                                            <span>{m}</span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setInitialMembers((p) => p.filter((x) => x !== m))
                                                }
                                                className="cursor-pointer"
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
                            disabled={createMutation.isPending}
                            className="w-full h-11 rounded-xl bg-primary text-on-primary text-sm font-bold cursor-pointer disabled:opacity-60"
                        >
                            {createMutation.isPending ? 'Creating...' : 'Create Room'}
                        </button>
                    </form>
                </div>
            )}

            {/* Join Room Modal */}
            {showJoinModal && (
                <div
                    className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs"
                    onClick={() => setShowJoinModal(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl border border-outline-variant/30 p-5 pb-safe shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
                    >
                        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
                            <h3 className="text-base font-bold text-on-surface font-headline">
                                Join Another Room
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowJoinModal(false)}
                                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center cursor-pointer"
                            >
                                <AppIcon name="close" className="text-[18px]" />
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowInviteScanner(true)}
                            className="w-full h-11 rounded-2xl bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <AppIcon name="qr_code_scanner" className="text-[18px]" />
                            <span>Scan Room Invite QR / Photo</span>
                        </button>

                        <form onSubmit={handleLookupJoin} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={joinInput}
                                onChange={(e) => setJoinInput(e.target.value)}
                                placeholder="Room code (e.g. SN-4821) or link..."
                                className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                            />
                            <button
                                type="submit"
                                className="h-10 px-3.5 rounded-xl bg-surface-container-high text-primary text-xs font-bold cursor-pointer shrink-0"
                            >
                                Lookup
                            </button>
                        </form>

                        {lookupCode && invitePreviewQuery.isLoading && (
                            <p className="text-xs text-on-surface-variant text-center py-2">
                                Loading room invite {lookupCode}...
                            </p>
                        )}

                        {lookupCode && invitePreviewQuery.isError && (
                            <p className="text-xs text-error text-center py-2">
                                Invite code &quot;{lookupCode}&quot; not found.
                            </p>
                        )}

                        {preview && (
                            <form
                                onSubmit={handleJoinRoom}
                                className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-3"
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                                        <AppIcon name={preview.icon || 'groups'} className="text-[20px]" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-bold text-on-surface truncate">
                                            {preview.name}
                                        </h4>
                                        <p className="text-[11px] text-on-surface-variant">
                                            {preview.memberCount} members • By {preview.createdByName}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/25 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={effectiveJoinSlot === '__new__'}
                                            onChange={() => setSelectedJoinSlot('__new__')}
                                            className="accent-primary"
                                        />
                                        <span className="text-xs font-semibold text-on-surface">
                                            Join as {customJoinName.trim() || user?.name}
                                        </span>
                                    </label>
                                    {effectiveJoinSlot === '__new__' && (
                                        <input
                                            type="text"
                                            value={customJoinName}
                                            onChange={(e) => setCustomJoinName(e.target.value)}
                                            placeholder={`Custom display name (default: ${user?.name || ''})`}
                                            className="w-full h-9 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/35 text-xs"
                                        />
                                    )}

                                    {preview.unclaimedMembers.map((slot) => (
                                        <label
                                            key={slot.memberId}
                                            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/25 cursor-pointer"
                                        >
                                            <input
                                                type="radio"
                                                checked={effectiveJoinSlot === slot.name}
                                                onChange={() => setSelectedJoinSlot(slot.name)}
                                                className="accent-primary"
                                            />
                                            <span className="text-xs font-semibold text-on-surface">
                                                Link to unclaimed &quot;{slot.name}&quot;
                                            </span>
                                        </label>
                                    ))}
                                </div>

                                <input
                                    type="text"
                                    value={joinUpiInput}
                                    onChange={(e) => setJoinUpiInput(e.target.value)}
                                    placeholder={user?.upiId || 'Your UPI ID (optional)'}
                                    className="w-full h-9 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/35 text-xs font-mono"
                                />

                                <button
                                    type="submit"
                                    disabled={joinMutation.isPending}
                                    className="w-full h-10 rounded-xl bg-primary text-on-primary text-xs font-bold cursor-pointer disabled:opacity-60"
                                >
                                    {joinMutation.isPending ? 'Joining...' : `Join "${preview.name}"`}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Edit Active Room Modal */}
            {showEditRoomModal && activeGroup && (
                <div
                    className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs"
                    onClick={() => setShowEditRoomModal(false)}
                >
                    <form
                        onSubmit={handleSaveRoomEdit}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl border border-outline-variant/30 p-5 pb-safe shadow-2xl space-y-3.5"
                    >
                        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
                            <h3 className="text-base font-bold text-on-surface font-headline">
                                Edit Room Details
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowEditRoomModal(false)}
                                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center cursor-pointer"
                            >
                                <AppIcon name="close" className="text-[18px]" />
                            </button>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-on-surface-variant">
                                Room Name
                            </label>
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                required
                                className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-on-surface-variant">
                                Subtitle
                            </label>
                            <input
                                type="text"
                                value={editSubtitle}
                                onChange={(e) => setEditSubtitle(e.target.value)}
                                className="w-full h-10 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs"
                            />
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                            {ROOM_ICONS.map((ic) => (
                                <button
                                    key={ic.id}
                                    type="button"
                                    onClick={() => setEditIcon(ic.id)}
                                    className={`py-2 px-1 rounded-xl border text-[10px] font-semibold flex flex-col items-center gap-1 cursor-pointer ${
                                        editIcon === ic.id
                                            ? 'bg-primary/12 border-primary text-primary'
                                            : 'bg-surface-container-low border-outline-variant/25 text-on-surface-variant'
                                    }`}
                                >
                                    <AppIcon name={ic.id} className="text-[18px]" />
                                    <span>{ic.label}</span>
                                </button>
                            ))}
                        </div>

                        <button
                            type="submit"
                            disabled={updateMutation.isPending}
                            className="w-full h-11 rounded-xl bg-primary text-on-primary text-sm font-bold cursor-pointer disabled:opacity-60"
                        >
                            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                        </button>
                    </form>
                </div>
            )}

            {/* Confirm Remove Member Modal */}
            {confirmRemoveMember && activeGroup && (
                <div
                    className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
                    onClick={() => setConfirmRemoveMember(null)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm bg-surface-container-lowest rounded-3xl border border-outline-variant/30 p-5 shadow-2xl space-y-4"
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-error/15 text-error flex items-center justify-center shrink-0">
                                <AppIcon name="warning" className="text-[20px]" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-sm font-bold text-on-surface">
                                    Remove &quot;{confirmRemoveMember.memberName}&quot; from &quot;{activeGroup.name}&quot;?
                                </h3>
                                <p className="text-xs text-on-surface-variant leading-relaxed">
                                    {confirmRemoveMember.isClaimed
                                        ? 'They will lose active access to this room and future splits, while retaining read-only access to all past expenses, splits, and settlements recorded prior to removal.'
                                        : 'This unclaimed member slot will be removed from the active room roster.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirmRemoveMember(null)}
                                className="flex-1 h-10 rounded-xl border border-outline-variant/40 text-xs font-semibold cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={removeMemberMutation.isPending}
                                onClick={() => void handleConfirmRemoveMember()}
                                className="flex-1 h-10 rounded-xl bg-error text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                            >
                                {removeMemberMutation.isPending ? 'Removing...' : 'Confirm Remove'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Leave Room Modal */}
            {confirmLeaveGroupId && (
                <div
                    className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
                    onClick={() => setConfirmLeaveGroupId(null)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm bg-surface-container-lowest rounded-3xl border border-outline-variant/30 p-5 shadow-2xl space-y-4"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-2xl bg-error/15 text-error flex items-center justify-center shrink-0">
                                <AppIcon name="warning" className="text-[20px]" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-on-surface">
                                    Leave &quot;{activeGroup?.name}&quot;?
                                </h3>
                                <p className="text-xs text-on-surface-variant">
                                    Your historical splits and settlements stay available in read-only Past Rooms, unless re-invited later.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirmLeaveGroupId(null)}
                                className="flex-1 h-10 rounded-xl border border-outline-variant/40 text-xs font-semibold cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={leaveMutation.isPending}
                                onClick={() => void handleConfirmLeave()}
                                className="flex-1 h-10 rounded-xl bg-error text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                            >
                                {leaveMutation.isPending ? 'Leaving...' : 'Leave Room'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Suspense fallback={null}>
                <QrScannerModal
                    isOpen={showInviteScanner}
                    onClose={() => setShowInviteScanner(false)}
                    mode="invite"
                    onScanInvite={(code) => {
                        setShowInviteScanner(false);
                        setSelectedJoinSlot('__new__');
                        setLookupCode(code);
                        setJoinInput(code);
                        showToast(`Found invite code ${code}`, 'qr_code_scanner');
                    }}
                />
            </Suspense>
        </div>
    );
};

export default GroupsPage;

