import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useExpense } from '../../context';
import { apiFetch, queryKeys, useAnalytics, usePeople } from '../../api';
import type { AnalyticsData, AnalyticsRange } from '../../api/types';
import { triggerHaptic } from '../../utils/haptics';
import { AnalyticsHeaderBar } from './components/AnalyticsHeaderBar';
import { AppIcon, AnalyticsSkeleton } from '../../components';
import { AnalyticsHeroSection } from './components/AnalyticsHeroSection';
import { InsightsStrip } from './components/InsightsStrip';
import { CategoryDonutCard } from './components/CategoryDonutCard';
import { DailyTrendCard } from './components/DailyTrendCard';
import { MonthlyTrendCard } from './components/MonthlyTrendCard';
import { SpendingHabitsCard } from './components/SpendingHabitsCard';
import { SettlementsHealthCard } from './components/SettlementsHealthCard';
import { MemberLeaderboardCard } from './components/MemberLeaderboardCard';
import { BreakdownLedgerCard } from './components/BreakdownLedgerCard';

export function AnalyticsPage() {
    const {
        activePerson,
        claimedPerson,
        isDeviceClaimed,
        isSwitcherUnlocked,
        setActiveTab,
        showToast,
    } = useExpense();
    const queryClient = useQueryClient();
    const { data: people = [] } = usePeople();

    const canSwitchScope = isSwitcherUnlocked || !isDeviceClaimed;
    const lockedPerson = claimedPerson || activePerson;

    const [selectedPerson, setSelectedPerson] = useState<string>(activePerson);
    const [selectedRange, setSelectedRange] = useState<AnalyticsRange>('all');
    const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [isManualRefreshing, setIsManualRefreshing] = useState(false);

    const effectivePerson = canSwitchScope ? selectedPerson : lockedPerson;

    const queryParams = useMemo(
        () => ({
            person: effectivePerson,
            month: selectedMonth,
            range: selectedMonth === 'ALL' ? selectedRange : 'all',
        }),
        [effectivePerson, selectedMonth, selectedRange]
    );

    const { data, isLoading, isFetching, isError, refetch } = useAnalytics(queryParams);

    const handleForceRefresh = async () => {
        triggerHaptic('medium');
        setIsManualRefreshing(true);
        try {
            const urlParams = new URLSearchParams();
            if (queryParams.person) urlParams.set('person', queryParams.person);
            if (queryParams.month && queryParams.month !== 'ALL') {
                urlParams.set('month', queryParams.month);
            }
            if (queryParams.range && queryParams.range !== 'all') {
                urlParams.set('range', queryParams.range);
            }
            urlParams.set('refresh', 'true');

            const fresh = await apiFetch<AnalyticsData>(`/analytics?${urlParams.toString()}`);
            queryClient.setQueryData(queryKeys.analytics(queryParams), fresh);
            showToast('Analytics synced with latest sheet data!', 'sync');
        } catch {
            await refetch();
            showToast('Could not reach server; showing cached insights', 'warning');
        } finally {
            setIsManualRefreshing(false);
        }
    };

    const handleSelectPerson = (person: string) => {
        setSelectedPerson(person);
        setSelectedCategory(null);
    };

    const handleSelectRange = (range: AnalyticsRange) => {
        triggerHaptic('light');
        setSelectedMonth('ALL');
        setSelectedRange(range);
        setSelectedCategory(null);
    };

    const handleSelectMonth = (month: string) => {
        triggerHaptic('light');
        setSelectedMonth(month);
        if (month !== 'ALL') {
            setSelectedRange('all');
        }
        setSelectedCategory(null);
    };

    const availablePeople = useMemo(() => {
        const list = data?.scope.availablePeople || people;
        return list.length > 0 ? list : [effectivePerson];
    }, [data?.scope.availablePeople, people, effectivePerson]);

    const availableMonths = data?.scope.availableMonths || [];
    const summary = data?.summary;
    const isGroupView = data?.scope.isGroupView ?? effectivePerson === 'ALL';

    return (
        <div className="flex flex-col w-full pb-12 space-y-4">
            <AnalyticsHeaderBar
                effectivePerson={effectivePerson}
                isGroupView={isGroupView}
                canSwitchScope={canSwitchScope}
                selectedPerson={selectedPerson}
                selectedRange={selectedRange}
                selectedMonth={selectedMonth}
                availablePeople={availablePeople}
                availableMonths={availableMonths}
                isRefreshing={isManualRefreshing || isFetching}
                onRefresh={handleForceRefresh}
                onSelectPerson={handleSelectPerson}
                onSelectRange={handleSelectRange}
                onSelectMonth={handleSelectMonth}
            />

            {isLoading && !data ? (
                <AnalyticsSkeleton />
            ) : isError && !data ? (
                <div className="p-6 rounded-2xl bg-surface-card border border-negative/30 shadow-[0_1px_3px_rgba(15,23,42,0.05)] text-center space-y-3">
                    <AppIcon name="cloud_off" className="text-3xl text-negative" />
                    <div>
                        <p className="text-sm font-bold text-on-surface">
                            Unable to load analytics
                        </p>
                        <p className="text-xs text-on-surface-variant mt-1">
                            Check your connection to the API and try refreshing.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => refetch()}
                        className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold cursor-pointer"
                    >
                        Retry
                    </button>
                </div>
            ) : (
                data &&
                summary && (
                    <>
                        <AnalyticsHeroSection summary={summary} isGroupView={isGroupView} />
                        <InsightsStrip insights={data.insights} />

                        <CategoryDonutCard
                            categories={data.byCategory}
                            selectedCategory={selectedCategory}
                            onSelectCategory={setSelectedCategory}
                            isGroupView={isGroupView}
                        />

                        <DailyTrendCard
                            dailyTrend={data.dailyTrend}
                            avgDailySpend={summary.avgDailySpend}
                        />

                        <MonthlyTrendCard
                            monthlyTrend={data.monthlyTrend}
                            selectedMonth={selectedMonth}
                            onSelectMonth={handleSelectMonth}
                        />

                        <SpendingHabitsCard
                            directSpend={summary.directSpend}
                            splitShareSpend={summary.splitShareSpend}
                            outOfPocketPaid={summary.outOfPocketPaid}
                            trueSpend={summary.trueSpend}
                            dayOfWeek={data.dayOfWeek}
                            isGroupView={isGroupView}
                        />

                        {isGroupView && data.memberBreakdown.length > 0 && (
                            <MemberLeaderboardCard
                                members={data.memberBreakdown}
                                canInspectMember={canSwitchScope}
                                onSelectMember={handleSelectPerson}
                            />
                        )}

                        <SettlementsHealthCard
                            settlements={data.settlementsOverview}
                            isGroupView={isGroupView}
                            onGoToOverview={() => setActiveTab('dashboard')}
                        />

                        <BreakdownLedgerCard
                            transactions={data.transactions}
                            selectedCategory={selectedCategory}
                            onClearCategory={() => setSelectedCategory(null)}
                        />
                    </>
                )
            )}
        </div>
    );
}

export default AnalyticsPage;
