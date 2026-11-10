import React from 'react';
import type { AnalyticsInsight } from '../../../api/types';

interface InsightsStripProps {
    insights: AnalyticsInsight[];
}

const INSIGHT_ICONS: Record<string, string> = {
    category: 'donut_large',
    cashflow: 'account_balance_wallet',
    trend: 'monitoring',
    habit: 'calendar_today',
    settlement: 'handshake',
};

const INSIGHT_TONE_CLASSES: Record<AnalyticsInsight['tone'], string> = {
    positive: 'bg-status-settled-bg/70 border-primary/20 text-status-settled-text',
    warning: 'bg-status-pending-bg/85 border-tertiary/25 text-status-pending-text',
    info: 'bg-surface-card border-border-subtle text-on-surface',
};

export const InsightsStrip: React.FC<InsightsStripProps> = ({ insights }) => {
    if (insights.length === 0) return null;

    return (
        <div className="space-y-2">
            <h2 className="label-pill uppercase text-on-surface-variant px-0.5">
                Key Insights
            </h2>
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 snap-x">
                {insights.map((ins) => {
                    const toneClasses = INSIGHT_TONE_CLASSES[ins.tone] || INSIGHT_TONE_CLASSES.info;
                    const iconName = INSIGHT_ICONS[ins.type] || 'insights';

                    return (
                        <div
                            key={ins.id}
                            className={`min-w-[245px] max-w-[270px] snap-start p-3.5 rounded-2xl border shadow-[0_1px_3px_rgba(15,23,42,0.05)] shrink-0 space-y-1 ${toneClasses}`}
                        >
                            <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[16px]">
                                    {iconName}
                                </span>
                                <span className="text-xs font-bold truncate">{ins.title}</span>
                            </div>
                            <p className="text-xs opacity-90 leading-relaxed">{ins.message}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default InsightsStrip;

