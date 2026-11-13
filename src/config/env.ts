/**
 * Centralized, validated environment configuration.
 * All configurable frontend values are managed here with safe defaults.
 */

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'https://localhost:8081').trim().replace(/\/+$/, '');

function isLocalHostUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname);
    } catch {
        return false;
    }
}

const useDevProxy =
    import.meta.env.DEV &&
    import.meta.env.VITE_DISABLE_DEV_PROXY !== 'true' &&
    /^https?:\/\//i.test(rawBaseUrl) &&
    !isLocalHostUrl(rawBaseUrl);

const resolvedBaseUrl: string = useDevProxy ? '/__splitnest_api' : rawBaseUrl;

export const ENV = {
    // API Configuration
    API_BASE_URL: resolvedBaseUrl,
    API_TIMEOUT_MS: Math.max(1000, Number(import.meta.env.VITE_API_TIMEOUT_MS) || 30000),

    // App Branding Defaults
    DEFAULT_TRIP_TITLE: import.meta.env.VITE_DEFAULT_TRIP_TITLE?.trim() || 'Trip Expense',
    DEFAULT_TRIP_SUBTITLE: import.meta.env.VITE_DEFAULT_TRIP_SUBTITLE?.trim() || 'Expense & Splitter',
    DEFAULT_TRIP_ICON: import.meta.env.VITE_DEFAULT_TRIP_ICON?.trim() || 'landscape',

    // User Defaults
    DEFAULT_ACTIVE_PERSON: import.meta.env.VITE_DEFAULT_ACTIVE_PERSON?.trim() || 'Niraj',
    GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || '',

    // UI & Behavior Configuration
    CURRENCY_SYMBOL: import.meta.env.VITE_CURRENCY_SYMBOL?.trim() || '₹',
    DESKTOP_BREAKPOINT: Math.max(320, Number(import.meta.env.VITE_DESKTOP_BREAKPOINT) || 768),
    TOAST_DURATION_MS: Math.max(1000, Number(import.meta.env.VITE_TOAST_DURATION_MS) || 2800),

    // Cache / React Query Configuration
    QUERY_STALE_TIME_MS: Math.max(1000, Number(import.meta.env.VITE_QUERY_STALE_TIME_MS) || 60000),
} as const;

export default ENV;
