import React from 'react';
import type { AnalyticsSettlementsOverview } from '../../../api/types';
import { Avatar } from '../../../components';
import { triggerHaptic } from '../../../utils/haptics';

interface SettlementsHealthCardProps {
    settlements: AnalyticsSettlementsOverview;
    isGroupView: boolean;
    onGoToOverview: () => void;
}

export const SettlementsHealthCard: React.FC<SettlementsHealthCardProps> = ({
    settlements,
    isGroupView,
    onGoToOverview,
}) => {
    const maxCounterparty = Math.max(
        1,
        ...settlements.counterparties.map((c) => Math.abs(c.netAmount))
    );

    const isFullySettled = settlements.pendingCount === 0;

    return (
        <section className="bg-surface-card p-4 rounded-2xl border border-border-subtle shadow-[0_1px_3px_rgba(15,23,42,0.05)] space-y-3.5">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h2 className="text-[20px] leading-[28px] font-semibold text-on-surface font-headline">
                        Settlement Health
                    </h2>
                    <p className="text-xs text-on-surface-variant">
                        {isGroupView
                            ? 'Group-wide pending balances & settlement completion'
                            : 'Live payables, receivables & counterparty balances'}
                    </p>
                </div>
                <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.05em] font-mono tabular-nums shrink-0 inline-flex items-center gap-1.5 ${
                        isFullySettled
                            ? 'bg-status-settled-bg text-status-settled-text'
                            : 'bg-status-pending-bg text-status-pending-text'
                    }`}
                >
                    <span
                        className={`w-1.5 h-1.5 rounded-full ${
                            isFullySettled ? 'bg-[#16a34a]' : 'bg-[#d97706]'
                        }`}
                    />
                    {settlements.settlementRatePct}% Settled
                </span>
            </div>

            {/* Completion Bar */}
            <div className="space-y-1.5">
                <div className="w-full h-2.5 bg-border-subtle/70 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-[width] duration-300"
                        style={{
                            width: `${Math.min(100, Math.max(0, settlements.settlementRatePct))}%`,
                        }}
                    />
                </div>
                <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono tabular-nums">
                    <span>{settlements.settledCount} settled</span>
                    <span>{settlements.pendingCount} pending</span>
                </div>
            </div>

            {/* Receive vs Pay Totals */}
            {!isGroupView && (
                <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-status-settled-bg/60 border border-primary/20">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-primary font-mono block">
                            To Receive
                        </span>
                        <span className="text-base font-bold text-primary font-mono tabular-nums">
                            +₹{settlements.toReceive.toLocaleString('en-IN')}
                        </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-error-container/50 border border-negative/20">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-negative font-mono block">
                            You Owe
                        </span>
                        <span className="text-base font-bold text-negative font-mono tabular-nums">
                            -₹{settlements.toPay.toLocaleString('en-IN')}
                        </span>
                    </div>
                </div>
            )}

            {/* Counterparties List */}
            {settlements.counterparties.length === 0 ? (
                <div className="p-3 rounded-xl bg-status-settled-bg/50 border border-primary/20 flex items-center gap-2 text-xs text-status-settled-text font-medium">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>
                        {(settlements.offsetSplitsCount ?? 0) > 0
                            ? `All balances offset pairwise to ₹0 (${settlements.offsetSplitsCount} mutual splits can be closed on Home).`
                            : 'All settlements are 100% cleared!'}
                    </span>
                </div>
            ) : (
                <div className="space-y-2">
                    {settlements.counterparties.map((cp) => {
                        const isPositive = cp.netAmount >= 0;
                        const barWidth = Math.max(
                            6,
                            Math.round((Math.abs(cp.netAmount) / maxCounterparty) * 100)
                        );
                        const hasOffset =
                            !isGroupView && cp.toReceive > 0 && cp.toPay > 0;
                        const offsetVal = Math.round(Math.min(cp.toReceive, cp.toPay) * 100) / 100;
                        return (
                            <div
                                key={cp.person}
                                className="p-2.5 rounded-xl bg-surface-card-subtle/60 border border-border-subtle space-y-1.5"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Avatar name={cp.person} size="sm" />
                                        <div className="min-w-0">
                                            <span className="text-xs font-bold text-on-surface truncate block">
                                                {cp.person}
                                            </span>
                                            <span className="text-[11px] text-on-surface-variant block">
                                                {cp.pendingCount} pending{' '}
                                                {cp.pendingCount === 1 ? 'split' : 'splits'}
                                                {hasOffset && offsetVal >= 0.01
                                                    ? ` • ₹${offsetVal.toLocaleString('en-IN')} offset`
                                                    : ''}
                                            </span>
                                        </div>
                                    </div>
                                    <span
                                        className={`text-sm font-semibold font-mono tabular-nums shrink-0 ${
                                            isPositive ? 'text-primary' : 'text-negative'
                                        }`}
                                    >
                                        {isPositive ? '+' : '-'}₹
                                        {Math.abs(cp.netAmount).toLocaleString('en-IN')}
                                    </span>
                                </div>
                                <div className="w-full h-1.5 bg-border-subtle/70 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${
                                            isPositive ? 'bg-primary' : 'bg-negative'
                                        }`}
                                        style={{ width: `${barWidth}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}

                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic('light');
                            onGoToOverview();
                        }}
                        className="w-full py-2.5 rounded-xl bg-secondary text-on-secondary hover:bg-secondary-dark text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-[background-color,transform] active:scale-[0.98]"
                    >
                        <span>Settle Pending Balances</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                </div>
            )}
        </section>
    );
};

export default SettlementsHealthCard;
