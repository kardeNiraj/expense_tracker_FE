import React, { useState } from 'react';
import { QRCode } from '../QRCode';
import { triggerHaptic } from '../../utils/haptics';
import { useExpense } from '../../context';
import { buildGroupInviteUrl } from '../../utils/qr';
import { AppIcon } from '../Icon/AppIcon';

interface JoinTripModalProps {
    isOpen: boolean;
    onClose: () => void;
    tripTitle: string;
    tripSubtitle: string;
    tripIcon: string;
}

export const JoinTripModal: React.FC<JoinTripModalProps> = ({
    isOpen,
    onClose,
    tripTitle,
    tripSubtitle,
    tripIcon,
}) => {
    const { activeGroup, groups, setActiveGroupId, setActiveTab, showToast } = useExpense();
    const [copied, setCopied] = useState<'link' | 'code' | null>(null);

    if (!isOpen) return null;

    const inviteCode = activeGroup ? activeGroup.inviteCode || '' : '';
    const isPrimaryRevoked = Boolean(activeGroup && !activeGroup.inviteCode);
    const displayTitle = activeGroup?.name || tripTitle;
    const displaySubtitle = activeGroup?.subtitle || tripSubtitle;
    const displayIcon = activeGroup?.icon || tripIcon;
    const joinUrl = buildGroupInviteUrl(inviteCode || undefined);

    const handleCopy = async (text: string, kind: 'link' | 'code') => {
        try {
            await navigator.clipboard.writeText(text);
            triggerHaptic('success');
            setCopied(kind);
            showToast(
                kind === 'code'
                    ? `Invite code ${text} copied!`
                    : 'Invite link copied to clipboard!',
                'content_copy'
            );
            setTimeout(() => setCopied(null), 2500);
        } catch {
            triggerHaptic('warning');
            showToast('Failed to copy link', 'error');
        }
    };

    const handleWhatsAppShare = () => {
        triggerHaptic('light');
        const codeLine = inviteCode ? `\nInvite Code: ${inviteCode}` : '';
        const text = `Hey! Join "${displayTitle}" on SplitNest to track and split bills seamlessly:\n👉 ${joinUrl}${codeLine}`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    };

    return (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            {/* Backdrop click dismiss */}
            <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

            {/* Bottom Sheet Card */}
            <div className="relative z-10 w-full max-w-sm max-h-[92vh] overflow-y-auto bg-surface-container-lowest border-t sm:border border-outline-variant/30 rounded-t-3xl sm:rounded-3xl p-5 pb-safe shadow-2xl space-y-4 text-on-surface animate-in slide-in-from-bottom duration-250">
                {/* Mobile Handle Pill */}
                <div className="w-12 h-1 bg-outline-variant/40 rounded-full mx-auto -mt-1 mb-2 sm:hidden" />

                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-xs shrink-0">
                            <AppIcon name={displayIcon} className="text-[22px]" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-base text-on-surface truncate font-headline">
                                Invite to {displayTitle}
                            </h3>
                            <p className="text-[11px] text-on-surface-variant truncate">
                                {displaySubtitle || 'Share QR or code with room members'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                        aria-label="Close"
                    >
                        <AppIcon name="close" className="text-[20px]" />
                    </button>
                </div>

                {/* Quick Room Switcher Pills inside QR Modal when member of multiple rooms */}
                {groups.length > 1 && (
                    <div className="space-y-1.5">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-on-surface-variant block">
                            Showing Invite For Room
                        </span>
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                            {groups.map((g) => {
                                const isCurrent = g.groupId === activeGroup?.groupId;
                                return (
                                    <button
                                        key={g.groupId}
                                        type="button"
                                        onClick={() => {
                                            if (!isCurrent) {
                                                triggerHaptic('selection');
                                                setActiveGroupId(g.groupId);
                                            }
                                        }}
                                        className={`h-8 px-2.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 shrink-0 border transition-colors cursor-pointer ${
                                            isCurrent
                                                ? 'bg-primary text-on-primary border-primary shadow-2xs'
                                                : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant border-outline-variant/30'
                                        }`}
                                    >
                                        <AppIcon name={g.icon || 'groups'} className="text-[14px]" />
                                        <span className="max-w-[130px] truncate">{g.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Dynamic QR Code Card (or Primary Revoked Notice) */}
                {isPrimaryRevoked ? (
                    <div className="bg-surface-container/40 border border-outline-variant/25 rounded-2xl p-5 flex flex-col items-center justify-center text-center space-y-2.5">
                        <div className="w-11 h-11 rounded-2xl bg-error/10 text-error flex items-center justify-center">
                            <AppIcon name="gpp_bad" className="text-[22px]" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-on-surface">
                                Primary Invite QR Was Revoked
                            </p>
                            <p className="text-[11px] text-on-surface-variant max-w-[250px]">
                                {activeGroup?.isOwner
                                    ? 'Open Manage Room & Members to generate a new primary QR or create scoped revocable invite links.'
                                    : 'Ask the room owner to issue a fresh invite link or token.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-surface-container/40 border border-outline-variant/25 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-3">
                        <div className="p-3 bg-white rounded-2xl shadow-sm border border-neutral-200">
                            <QRCode value={joinUrl} size={190} />
                        </div>
                        {inviteCode && (
                            <button
                                type="button"
                                onClick={() => void handleCopy(inviteCode, 'code')}
                                className="px-3 py-1 rounded-full bg-surface-container-lowest border border-outline-variant/35 hover:border-primary/40 flex items-center gap-1.5 text-xs font-mono font-bold text-primary cursor-pointer"
                                title="Tap to copy invite code"
                            >
                                <span>Code: {inviteCode}</span>
                                <AppIcon
                                    name={copied === 'code' ? 'check' : 'content_copy'}
                                    className="text-[13px]"
                                />
                            </button>
                        )}
                        <div className="space-y-0.5">
                            <p className="text-xs font-bold text-on-surface flex items-center justify-center gap-1">
                                <AppIcon name="qr_code_scanner" className="text-[15px] text-primary" />
                                <span>Scan with Phone Camera</span>
                            </p>
                            <p className="text-[11px] text-on-surface-variant max-w-[240px]">
                                Friends scan this QR to sign in and join <strong className="text-on-surface">{displayTitle}</strong> automatically
                            </p>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 pt-1">
                    {!isPrimaryRevoked && (
                        <>
                            <button
                                type="button"
                                onClick={handleWhatsAppShare}
                                className="w-full h-11 px-3.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-[0.98] cursor-pointer"
                            >
                                <AppIcon name="chat" className="text-[18px]" />
                                <span>Share Invite via WhatsApp</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => void handleCopy(joinUrl, 'link')}
                                className="w-full h-10 px-3.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center justify-center gap-2 border border-outline-variant/30 transition-all active:scale-[0.98] cursor-pointer"
                            >
                                <AppIcon name={copied === 'link' ? 'check' : 'content_copy'} className="text-[16px] text-primary" />
                                <span>{copied === 'link' ? 'Invite Link Copied!' : 'Copy Invite Link'}</span>
                            </button>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic('light');
                            onClose();
                            setActiveTab('groups');
                        }}
                        className="w-full h-10 px-3.5 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                        <AppIcon name="groups" className="text-[17px]" />
                        <span>Manage Room &amp; Revocable Links</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JoinTripModal;

