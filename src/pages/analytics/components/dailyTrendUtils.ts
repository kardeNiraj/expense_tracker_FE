import type { AnalyticsDailyPoint } from '../../../api/types';

export const DAILY_CHART_DIMENSIONS = {
    width: 340,
    height: 150,
    padLeft: 8,
    padRight: 8,
    padTop: 14,
    padBottom: 22,
} as const;

export interface AxisTick {
    idx: number;
    label: string;
}

export interface CumulativePoint {
    x: number;
    y: number;
    date: string;
}

export function buildDailyAxisLabels(dailyTrend: AnalyticsDailyPoint[]): AxisTick[] {
    if (dailyTrend.length === 0) return [];
    if (dailyTrend.length <= 4) {
        return dailyTrend.map((d, idx) => ({ idx, label: d.label }));
    }
    const indices = [
        0,
        Math.floor((dailyTrend.length - 1) / 3),
        Math.floor(((dailyTrend.length - 1) * 2) / 3),
        dailyTrend.length - 1,
    ];
    return Array.from(new Set(indices)).map((idx) => ({
        idx,
        label: dailyTrend[idx].label,
    }));
}

export function buildCumulativePath(
    dailyTrend: AnalyticsDailyPoint[],
    mode: 'daily' | 'cumulative',
    maxValue: number
): { path: string; area: string; points: CumulativePoint[] } {
    if (dailyTrend.length === 0) {
        return { path: '', area: '', points: [] };
    }
    const innerW =
        DAILY_CHART_DIMENSIONS.width -
        DAILY_CHART_DIMENSIONS.padLeft -
        DAILY_CHART_DIMENSIONS.padRight;
    const innerH =
        DAILY_CHART_DIMENSIONS.height -
        DAILY_CHART_DIMENSIONS.padTop -
        DAILY_CHART_DIMENSIONS.padBottom;
    const step = dailyTrend.length > 1 ? innerW / (dailyTrend.length - 1) : innerW / 2;

    const pts = dailyTrend.map((d, idx) => {
        const val = mode === 'cumulative' ? d.cumulativeAmount : d.amount;
        const x =
            dailyTrend.length === 1
                ? DAILY_CHART_DIMENSIONS.padLeft + innerW / 2
                : DAILY_CHART_DIMENSIONS.padLeft + idx * step;
        const y = DAILY_CHART_DIMENSIONS.padTop + innerH - (val / maxValue) * innerH;
        return { x, y, date: d.date };
    });

    const path = pts
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ');
    const bottomY = DAILY_CHART_DIMENSIONS.padTop + innerH;
    const area =
        pts.length > 0
            ? `${path} L ${pts[pts.length - 1].x.toFixed(1)} ${bottomY} L ${pts[0].x.toFixed(1)} ${bottomY} Z`
            : '';

    return { path, area, points: pts };
}

