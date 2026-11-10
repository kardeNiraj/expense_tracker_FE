import React from 'react';
import type { AnalyticsMemberStat } from '../../../api/types';
import { Avatar } from '../../../components';
import { triggerHaptic } from '../../../utils/haptics';

interface MemberLeaderboardCardProps {
    members: AnalyticsMemberStat[];
    canInspectMember: boolean;
    onSelectMember: (person: string) => void;
}

export const MemberLeaderboardCard: React.FC<MemberLeaderboardCardProps> = ({
    members,
    canInspectMember,
    onSelectMember,
}) => {
    if (members.length === 0) return null;

    const maxMemberSpend = Math.max(
        1,
        ...members.map((m) => Math.max(m.trueSpend, m.outOfPocketPaid))
    );

    return (
        <section className="bg-surface-card p-4 rounded-2xl border border-border-subtle shadow-[0_1px_3px_rgba(15,23,42,0.05)] space-y-3">
            <div>
                <h2 className="text-[20px] leading-[28px] font-semibold text-on-surface font-headline">
                    Member Spend Comparison
                </h2>
                <p className="text-xs text-on-surface-variant">
                    Consumed share vs. upfront paid across all trip members
                </p>
            </div>

            <div className="space-y-2.5">
                {members.map((member) => {
                    const shareWidth = Math.max(
                        4,
                        Math.round((member.trueSpend / maxMemberSpend) * 100)
                    );
                    const paidWidth = Math.max(
                        member.outOfPocketPaid > 0 ? 4 : 0,
                        Math.round((member.outOfPocketPaid / maxMemberSpend) * 100)
                    );

                    return (
                        <button
                            key={member.person}
                            type="button"
                            disabled={!canInspectMember}
                            onClick={() => {
                                if (!canInspectMember) return;
                                triggerHaptic('light');
                                onSelectMember(member.person);
                            }}
                            className={`w-full text-left p-2.5 rounded-xl bg-surface-card-subtle/60 border border-border-subtle space-y-2 ${
                                canInspectMember
                                    ? 'hover:border-primary/50 cursor-pointer transition-colors'
                                    : 'cursor-default'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Avatar name={member.person} size="sm" />
                                    <div className="min-w-0">
                                        <span className="text-xs font-bold text-on-surface truncate block">
                                            {member.person}
                                        </span>
                                        <span className="text-[11px] text-on-surface-variant block tabular-nums">
                                            {member.shareOfGroupPct}% of group · Paid ₹
                                            {member.outOfPocketPaid.toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-sm font-semibold text-on-surface font-mono tabular-nums block">
                                        ₹{member.trueSpend.toLocaleString('en-IN')}
                                    </span>
                                    <span className="text-[10px] text-on-surface-variant font-mono">
                                        share
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="w-full h-1.5 bg-border-subtle/70 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[#065f46] rounded-full transition-[width] duration-300"
                                        style={{ width: `${shareWidth}%` }}
                                    />
                                </div>
                                {paidWidth > 0 && (
                                    <div className="w-full h-1 bg-border-subtle/70 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#0284c7] rounded-full transition-[width] duration-300"
                                            style={{ width: `${paidWidth}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center justify-center gap-4 text-[11px] text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-1.5 rounded-xs bg-[#065f46]" />
                    True Share
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-1 rounded-xs bg-[#0284c7]" />
                    Paid Upfront
                </span>
            </div>
        </section>
    );
};

export default MemberLeaderboardCard;
