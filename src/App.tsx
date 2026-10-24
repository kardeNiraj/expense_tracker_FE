import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExpenseProvider, useExpense } from './context';
import { MobileGate, Header, BottomNav, Toast } from './components';
import { Dashboard, SplitsPage, AddPage, PeoplePage } from './pages';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            staleTime: 1000 * 60, // 1 minute default
            retry: 1,
        },
    },
});

function MainApp() {
    const { activeTab } = useExpense();

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
