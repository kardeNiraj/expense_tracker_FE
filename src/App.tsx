import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExpenseProvider, useExpense } from './context';
import { MobileGate, Header, BottomNav, Toast, InstallPrompt, PullToRefresh } from './components';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { Dashboard, SplitsPage, AddPage, PeoplePage, ClaimIdentityScreen } from './pages';
import { ENV } from './config';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            staleTime: ENV.QUERY_STALE_TIME_MS,
            retry: 1,
        },
    },
});

function MainApp() {
    const { activeTab, isDeviceClaimed, isSwitcherUnlocked, showToast } = useExpense();
    const queryClient = useQueryClient();

    const handleGlobalRefresh = async () => {
        try {
            await Promise.allSettled([
                apiFetch('/people?refresh=true'),
                apiFetch('/categories?refresh=true'),
                apiFetch('/trip-info?refresh=true'),
                apiFetch('/people/details?refresh=true'),
            ]);
            await queryClient.invalidateQueries();
            await queryClient.refetchQueries({ type: 'active' });
            showToast('Refreshed latest data from Sheet!', 'sync');
        } catch {
            showToast('Refreshed!', 'sync');
        }
    };

    // Show device claim & identity selection screen on first load / unclaimed device
    if (!isDeviceClaimed && !isSwitcherUnlocked) {
        return (
            <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col relative font-sans">
                <div className="max-w-md mx-auto w-full px-4 pt-3">
                    <InstallPrompt />
                </div>
                <ClaimIdentityScreen />
                <Toast />
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col relative font-sans">
            {/* Sticky Header with Trip Brand & Active Person Switcher */}
            <Header />

            {/* Main Content Area */}
            <PullToRefresh onRefresh={handleGlobalRefresh}>
                <main className="flex-1 w-full max-w-md mx-auto px-4 pt-20 pb-24 relative">
                    <InstallPrompt />
                    {activeTab === 'dashboard' && <Dashboard />}
                    {activeTab === 'splits' && <SplitsPage />}
                    {activeTab === 'add' && <AddPage />}
                    {activeTab === 'people' && <PeoplePage />}
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
