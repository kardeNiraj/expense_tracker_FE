import React, { useId } from 'react';
import type { AnalyticsDailyPoint } from '../../../api/types';
import { triggerHaptic } from '../../../utils/haptics';
import {
    DAILY_CHART_DIMENSIONS,
    type AxisTick,
    type CumulativePoint,
} from './dailyTrendUtils';

interface DailyBarsSvgProps {
    dailyTrend: AnalyticsDailyPoint[];
    avgDailySpend: number;
    maxValue: number;
    selectedDate: string | null;
    activeDate: string | undefined;
    axisLabels: AxisTick[];
    onSelectDate: (date: string) => void;
}

export const DailyBarsSvg: React.FC<DailyBarsSvgProps> = ({
    dailyTrend,
    avgDailySpend,
    maxValue,
    selectedDate,
    activeDate,
    axisLabels,
    onSelectDate,
}) => {
    const innerW =
        DAILY_CHART_DIMENSIONS.width -
        DAILY_CHART_DIMENSIONS.padLeft -
        DAILY_CHART_DIMENSIONS.padRight;
    const innerH =
        DAILY_CHART_DIMENSIONS.height -
        DAILY_CHART_DIMENSIONS.padTop -
        DAILY_CHART_DIMENSIONS.padBottom;
    const bottomY = DAILY_CHART_DIMENSIONS.padTop + innerH;
    const barSlot = dailyTrend.length > 0 ? innerW / dailyTrend.length : innerW;
    const barWidth = Math.max(3, Math.min(20, barSlot * 0.68));
    const avgY =
        DAILY_CHART_DIMENSIONS.padTop +
        innerH -
        (Math.min(avgDailySpend, maxValue) / maxValue) * innerH;

    return (
        <svg
            viewBox={`0 0 ${DAILY_CHART_DIMENSIONS.width} ${DAILY_CHART_DIMENSIONS.height}`}
            className="w-full h-40 select-none overflow-visible"
            role="img"
            aria-label="Daily spend bar chart"
        >
            <line
                x1={DAILY_CHART_DIMENSIONS.padLeft}
                y1={bottomY}
                x2={DAILY_CHART_DIMENSIONS.padLeft + innerW}
                y2={bottomY}
                stroke="#cbd5e1"
                strokeWidth="1"
            />

            {avgDailySpend > 0 && (
                <g>
                    <line
                        x1={DAILY_CHART_DIMENSIONS.padLeft}
                        y1={avgY}
                        x2={DAILY_CHART_DIMENSIONS.padLeft + innerW}
                        y2={avgY}
                        stroke="#d97706"
                        strokeWidth="1"
                        strokeDasharray="4 3"
                        opacity="0.75"
                    />
                    <text
                        x={DAILY_CHART_DIMENSIONS.padLeft + innerW}
                        y={Math.max(10, avgY - 4)}
                        textAnchor="end"
                        className="fill-tertiary text-[8px] font-mono font-semibold"
                    >
                        Avg ₹{Math.round(avgDailySpend).toLocaleString('en-IN')}
                    </text>
                </g>
            )}

            {dailyTrend.map((point, idx) => {
                const xCenter = DAILY_CHART_DIMENSIONS.padLeft + idx * barSlot + barSlot / 2;
                const totalH = Math.max(
                    point.amount > 0 ? 3 : 0,
                    (point.amount / maxValue) * innerH
                );
                const splitH = point.amount > 0 ? (point.splitAmount / point.amount) * totalH : 0;
                const directH = Math.max(0, totalH - splitH);
                const isSelected = activeDate === point.date;
                const opacity = selectedDate && !isSelected ? 0.55 : 1;

                return (
                    <g
                        key={point.date}
                        className="cursor-pointer"
                        onClick={() => {
                            triggerHaptic('light');
                            onSelectDate(point.date);
                        }}
                    >
                        <rect
                            x={DAILY_CHART_DIMENSIONS.padLeft + idx * barSlot}
                            y={DAILY_CHART_DIMENSIONS.padTop}
                            width={barSlot}
                            height={innerH}
                            fill="transparent"
                        />
                        {point.amount === 0 ? (
                            <rect
                                x={xCenter - Math.min(4, barWidth / 2)}
                                y={bottomY - 2}
                                width={Math.min(8, barWidth)}
                                height={2}
                                rx="1"
                                fill="#cbd5e1"
                            />
                        ) : (
                            <>
                                {splitH > 0 && (
                                    <rect
                                        x={xCenter - barWidth / 2}
                                        y={bottomY - splitH}
                                        width={barWidth}
                                        height={splitH}
                                        rx={directH > 0 ? 1 : 2.5}
                                        fill={isSelected ? '#004532' : '#065f46'}
                                        opacity={opacity}
                                    />
                                )}
                                {directH > 0 && (
                                    <rect
                                        x={xCenter - barWidth / 2}
                                        y={bottomY - splitH - directH}
                                        width={barWidth}
                                        height={directH}
                                        rx="2"
                                        fill={isSelected ? '#0369a1' : '#0284c7'}
                                        opacity={opacity}
                                    />
                                )}
                            </>
                        )}
                    </g>
                );
            })}

            {axisLabels.map((tick) => {
                const x = DAILY_CHART_DIMENSIONS.padLeft + tick.idx * barSlot + barSlot / 2;
                return (
                    <text
                        key={`${tick.idx}-${tick.label}`}
                        x={x}
                        y={DAILY_CHART_DIMENSIONS.height - 4}
                        textAnchor="middle"
                        className="fill-on-surface-variant text-[9px] font-mono"
                    >
                        {tick.label}
                    </text>
                );
            })}
        </svg>
    );
};

interface CumulativeAreaSvgProps {
    totalDays: number;
    path: string;
    area: string;
    points: CumulativePoint[];
    activeDate: string | undefined;
    axisLabels: AxisTick[];
    onSelectDate: (date: string) => void;
}

export const CumulativeAreaSvg: React.FC<CumulativeAreaSvgProps> = ({
    totalDays,
    path,
    area,
    points,
    activeDate,
    axisLabels,
    onSelectDate,
}) => {
    const gradId = useId();
    const innerW =
        DAILY_CHART_DIMENSIONS.width -
        DAILY_CHART_DIMENSIONS.padLeft -
        DAILY_CHART_DIMENSIONS.padRight;
    const innerH =
        DAILY_CHART_DIMENSIONS.height -
        DAILY_CHART_DIMENSIONS.padTop -
        DAILY_CHART_DIMENSIONS.padBottom;
    const bottomY = DAILY_CHART_DIMENSIONS.padTop + innerH;

    return (
        <svg
            viewBox={`0 0 ${DAILY_CHART_DIMENSIONS.width} ${DAILY_CHART_DIMENSIONS.height}`}
            className="w-full h-40 select-none overflow-visible"
            role="img"
            aria-label="Cumulative spend line chart"
        >
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f766e" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#0f766e" stopOpacity="0.02" />
                </linearGradient>
            </defs>

            <line
                x1={DAILY_CHART_DIMENSIONS.padLeft}
                y1={bottomY}
                x2={DAILY_CHART_DIMENSIONS.padLeft + innerW}
                y2={bottomY}
                stroke="#cbd5e1"
                strokeWidth="1"
            />

            {area && <path d={area} fill={`url(#${gradId})`} />}
            {path && (
                <path
                    d={path}
                    fill="none"
                    stroke="#0f766e"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}

            {points.map((pt) => {
                const isSelected = activeDate === pt.date;
                return (
                    <g
                        key={pt.date}
                        className="cursor-pointer"
                        onClick={() => {
                            triggerHaptic('light');
                            onSelectDate(pt.date);
                        }}
                    >
                        <circle cx={pt.x} cy={pt.y} r="10" fill="transparent" />
                        {(isSelected || totalDays <= 16) && (
                            <circle
                                cx={pt.x}
                                cy={pt.y}
                                r={isSelected ? 4.5 : 2.5}
                                fill={isSelected ? '#065f46' : '#ffffff'}
                                stroke="#0f766e"
                                strokeWidth="2"
                            />
                        )}
                    </g>
                );
            })}

            {axisLabels.map((tick) => (
                <text
                    key={`${tick.idx}-${tick.label}`}
                    x={points[tick.idx]?.x ?? DAILY_CHART_DIMENSIONS.padLeft}
                    y={DAILY_CHART_DIMENSIONS.height - 4}
                    textAnchor="middle"
                    className="fill-on-surface-variant text-[9px] font-mono"
                >
                    {tick.label}
                </text>
            ))}
        </svg>
    );
};
