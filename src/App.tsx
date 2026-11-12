import { useState, useEffect, lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ExpenseProvider, useExpense } from './context';
import { getTabFromPathname } from './context/expenseStorage';
import {
    MobileGate,
    Header,
    BottomNav,
    Toast,
    InstallPrompt,
    PullToRefresh,
    PwaUpdatePrompt,
    AppShellSkeleton,
    SplitsSkeleton,
    AddPageSkeleton,
    PeopleSkeleton,
    ClaimIdentitySkeleton,
    AnalyticsSkeleton,
    AdminSkeleton,
} from './components';
import { apiFetch, queryKeys } from './api';
import Dashboard from './pages/home/index.tsx';
import { ENV } from './config';
import { setupQueryCachePersistence } from './utils/idbQueryCache';
import { processOfflineQueue } from './utils/offlineQueue';
import { syncPersistentDeviceId } from './utils/deviceIdentity';
import {
    resetPushSyncSession,
    syncExistingPushSubscription,
} from './utils/pushNotifications';

const SplitsPage = lazy(() => import('./pages/splits/index.tsx'));
const AddPage = lazy(() => import('./pages/add/index.tsx'));
const PeoplePage = lazy(() => import('./pages/people/index.tsx'));
const ClaimIdentityScreen = lazy(() => import('./pages/claim/ClaimIdentityScreen.tsx'));
const DeviceBlockedScreen = lazy(() => import('./pages/claim/DeviceBlockedScreen.tsx'));
const AnalyticsPage = lazy(() => import('./pages/analytics/index.tsx'));
const AdminPage = lazy(() => import('./pages/admin/index.tsx'));

const IDB_STARTUP_TIMEOUT_MS = 1200;

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            networkMode: 'offlineFirst',
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            staleTime: ENV.QUERY_STALE_TIME_MS || 1000 * 60,
            gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days cache retention
            retry: 1,
        },
        mutations: {
            networkMode: 'always',
        },
    },
});

function MainApp() {
    const {
        activeTab,
        setActiveTab,
        setFocusedSplitId,
        claimedPerson,
        isDeviceClaimed,
        isDeviceBlocked,
        isSwitcherUnlocked,
        refreshDeviceStatus,
        showToast,
    } = useExpense();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
            return;
        }

        const handleSwMessage = (event: MessageEvent) => {
            const msg = event.data as
                | {
                      type?: string;
                      url?: string;
                      splitId?: string | null;
                  }
                | undefined;

            if (!msg?.type) return;

            if (msg.type === 'PUSH_RECEIVED' || msg.type === 'NAVIGATE_TO') {
                void queryClient.invalidateQueries({ queryKey: ['splits'] });
                void queryClient.invalidateQueries({ queryKey: ['spendings'] });
                void queryClient.invalidateQueries({ queryKey: ['analytics'] });
                void queryClient.invalidateQueries({ queryKey: ['admin'] });
                void queryClient.invalidateQueries({ queryKey: ['device', 'me'] });
            }

            if (msg.type === 'NAVIGATE_TO') {
                if (msg.url) {
                    try {
                        const parsed = new URL(msg.url, window.location.origin);
                        setActiveTab(getTabFromPathname(parsed.pathname));
                        const urlSplitId = parsed.searchParams.get('splitId');
                        const targetSplitId = msg.splitId || urlSplitId || null;
                        if (targetSplitId) {
                            setFocusedSplitId(targetSplitId);
                        }
                    } catch {
                        if (msg.splitId) {
                            setActiveTab('splits');
                            setFocusedSplitId(msg.splitId);
                        }
                    }
                } else if (msg.splitId) {
                    setActiveTab('splits');
                    setFocusedSplitId(msg.splitId);
                }
            }

            if (msg.type === 'PUSH_SUBSCRIPTION_CHANGED') {
                resetPushSyncSession();
                void syncExistingPushSubscription({
                    person: claimedPerson,
                    force: true,
                });
                void queryClient.invalidateQueries({ queryKey: queryKeys.pushStatus() });
            }
        };

        navigator.serviceWorker.addEventListener('message', handleSwMessage);
        return () => {
            navigator.serviceWorker.removeEventListener('message', handleSwMessage);
        };
    }, [claimedPerson, queryClient, setActiveTab, setFocusedSplitId]);

    const handleGlobalRefresh = async () => {
        try {
            // Check for newly deployed Service Worker updates when pulling down
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then((reg) => reg.update()).catch(() => {});
            }

            await Promise.allSettled([
                refreshDeviceStatus(),
                apiFetch('/people?refresh=true'),
                apiFetch('/categories?refresh=true'),
                apiFetch('/trip-info?refresh=true'),
                apiFetch('/people/details?refresh=true'),
            ]);
            // Also flush any pending queued operations in the background
            processOfflineQueue(queryClient).catch(() => {});
            await queryClient.invalidateQueries();
            await queryClient.refetchQueries({ type: 'active' });
            showToast('Refreshed latest data from Sheet!', 'sync');
        } catch {
            showToast('Refreshed!', 'sync');
        }
    };

    if (isDeviceBlocked && !isSwitcherUnlocked) {
        return (
            <div className="min-h-screen w-full bg-surface-canvas text-on-surface flex flex-col relative font-sans">
                <PwaUpdatePrompt />
                <Suspense fallback={<ClaimIdentitySkeleton />}>
                    <DeviceBlockedScreen />
                </Suspense>
                <Toast />
            </div>
        );
    }

    // Direct /admin visit before claiming still renders strict Admin Sign-In Gate
    if (!isDeviceClaimed && !isSwitcherUnlocked && activeTab === 'admin') {
        return (
            <div className="min-h-screen w-full bg-surface-canvas text-on-surface flex flex-col relative font-sans">
                <PwaUpdatePrompt />
                <main className="flex-1 w-full max-w-md mx-auto px-4 pt-6 pb-10 relative">
                    <Suspense fallback={<AdminSkeleton />}>
                        <AdminPage />
                    </Suspense>
                </main>
                <Toast />
            </div>
        );
    }

    // Show device claim & identity selection screen on first load / unclaimed device
    if (!isDeviceClaimed && !isSwitcherUnlocked) {
        return (
            <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col relative font-sans">
                <PwaUpdatePrompt />
                <div className="max-w-md mx-auto w-full px-4 pt-3">
                    <InstallPrompt />
                </div>
                <Suspense fallback={<ClaimIdentitySkeleton />}>
                    <ClaimIdentityScreen />
                </Suspense>
                <Toast />
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col relative font-sans">
            <PwaUpdatePrompt />
            {/* Sticky Header with Trip Brand & Active Person Switcher */}
            <Header />

            {/* Main Content Area */}
            <PullToRefresh onRefresh={handleGlobalRefresh}>
                <main className="flex-1 w-full max-w-md mx-auto px-4 pt-20 pb-24 relative">
                    <InstallPrompt />
                    {activeTab === 'dashboard' && <Dashboard />}
                    {activeTab === 'splits' && (
                        <Suspense fallback={<SplitsSkeleton />}>
                            <SplitsPage />
                        </Suspense>
                    )}
                    {activeTab === 'add' && (
                        <Suspense fallback={<AddPageSkeleton />}>
                            <AddPage />
                        </Suspense>
                    )}
                    {activeTab === 'analytics' && (
                        <Suspense fallback={<AnalyticsSkeleton />}>
                            <AnalyticsPage />
                        </Suspense>
                    )}
                    {activeTab === 'admin' && (
                        <Suspense fallback={<AdminSkeleton />}>
                            <AdminPage />
                        </Suspense>
                    )}
                    {activeTab === 'people' && (
                        <Suspense fallback={<PeopleSkeleton />}>
                            <PeoplePage />
                        </Suspense>
                    )}
                </main>
            </PullToRefresh>

            {/* Bottom Tab Navigation Bar */}
            <BottomNav />

            {/* Global Interactive Toast */}
            <Toast />
        </div>
    );
}

export function App() {
    const [isCacheReady, setIsCacheReady] = useState(false);

    useEffect(() => {
        let mounted = true;
        let settled = false;
        const initialTab =
            typeof window !== 'undefined' ? getTabFromPathname(window.location.pathname) : 'dashboard';

        const finishStartup = () => {
            if (!mounted || settled) return;
            settled = true;
            setIsCacheReady(true);
            // Proactively prefetch people details & member list on startup
            // so UPI IDs and QR collection are ready offline even before visiting People tab
            if (typeof navigator !== 'undefined' && navigator.onLine) {
                queryClient.prefetchQuery({
                    queryKey: queryKeys.peopleDetails(),
                    queryFn: () => apiFetch('/people/details?refresh=false'),
                });
                queryClient.prefetchQuery({
                    queryKey: queryKeys.people(false),
                    queryFn: () => apiFetch('/people?refresh=false'),
                });
            }
        };

        const timeoutId = window.setTimeout(finishStartup, IDB_STARTUP_TIMEOUT_MS);

        Promise.allSettled([
            setupQueryCachePersistence(queryClient, {
                deferAnalytics: initialTab !== 'analytics',
            }),
            syncPersistentDeviceId(),
        ]).finally(() => {
            window.clearTimeout(timeoutId);
            finishStartup();
        });

        return () => {
            mounted = false;
            window.clearTimeout(timeoutId);
        };
    }, []);

    useEffect(() => {
        if (!isCacheReady) return;

        const prefetchLazyRoutes = () => {
            void import('./pages/splits/index.tsx');
            void import('./pages/add/index.tsx');
            void import('./pages/people/index.tsx');
            void import('./pages/analytics/index.tsx');
        };

        const win = window as Window & {
            requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
            cancelIdleCallback?: (handle: number) => void;
        };

        if (typeof win.requestIdleCallback === 'function') {
            const idleId = win.requestIdleCallback(prefetchLazyRoutes, { timeout: 2500 });
            return () => {
                win.cancelIdleCallback?.(idleId);
            };
        }

        const timerId = window.setTimeout(prefetchLazyRoutes, 400);
        return () => {
            window.clearTimeout(timerId);
        };
    }, [isCacheReady]);

    if (!isCacheReady) {
        return <AppShellSkeleton />;
    }

    return (
        <QueryClientProvider client={queryClient}>
            <ExpenseProvider>
                <MobileGate>
                    <MainApp />
                </MobileGate>
            </ExpenseProvider>
        </QueryClientProvider>
    );
}

export default App;
