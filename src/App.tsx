import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExpenseProvider, useExpense } from './context';
import { MobileGate, Header, BottomNav, Toast } from './components';
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
    const { activeTab, isDeviceClaimed, isSwitcherUnlocked } = useExpense();

    // Show device claim & identity selection screen on first load / unclaimed device
    if (!isDeviceClaimed && !isSwitcherUnlocked) {
        return (
            <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col relative font-sans">
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
            <main className="flex-1 w-full max-w-md mx-auto px-4 pt-20 pb-24 relative">
                {activeTab === 'dashboard' && <Dashboard />}
                {activeTab === 'splits' && <SplitsPage />}
                {activeTab === 'add' && <AddPage />}
                {activeTab === 'people' && <PeoplePage />}
            </main>

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
