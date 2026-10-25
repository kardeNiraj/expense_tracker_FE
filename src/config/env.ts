/**
 * Centralized, validated environment configuration.
 * All configurable frontend values are managed here with safe defaults.
 */

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'https://localhost:8081').trim().replace(/\/+$/, '');

export const ENV = {
    // API Configuration
    API_BASE_URL: rawBaseUrl,
    API_TIMEOUT_MS: Math.max(1000, Number(import.meta.env.VITE_API_TIMEOUT_MS) || 30000),

    // App Branding Defaults
    DEFAULT_TRIP_TITLE: import.meta.env.VITE_DEFAULT_TRIP_TITLE?.trim() || 'Trip Expense',
    DEFAULT_TRIP_SUBTITLE: import.meta.env.VITE_DEFAULT_TRIP_SUBTITLE?.trim() || 'Expense & Splitter',
    DEFAULT_TRIP_ICON: import.meta.env.VITE_DEFAULT_TRIP_ICON?.trim() || 'landscape',

    // User Defaults
    DEFAULT_ACTIVE_PERSON: import.meta.env.VITE_DEFAULT_ACTIVE_PERSON?.trim() || 'Niraj',

    // UI & Behavior Configuration
    CURRENCY_SYMBOL: import.meta.env.VITE_CURRENCY_SYMBOL?.trim() || '₹',
    DESKTOP_BREAKPOINT: Math.max(320, Number(import.meta.env.VITE_DESKTOP_BREAKPOINT) || 768),
    TOAST_DURATION_MS: Math.max(1000, Number(import.meta.env.VITE_TOAST_DURATION_MS) || 2800),

    // Security / Admin Configuration
    ADMIN_PASSCODE: import.meta.env.VITE_ADMIN_PASSCODE?.trim() || '1234',

    // Cache / React Query Configuration
    QUERY_STALE_TIME_MS: Math.max(1000, Number(import.meta.env.VITE_QUERY_STALE_TIME_MS) || 60000),
} as const;

export default ENV;
