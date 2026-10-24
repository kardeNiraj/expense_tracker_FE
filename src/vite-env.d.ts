/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL?: string;
    readonly VITE_API_TIMEOUT_MS?: string;
    readonly VITE_DEFAULT_TRIP_TITLE?: string;
    readonly VITE_DEFAULT_TRIP_SUBTITLE?: string;
    readonly VITE_DEFAULT_TRIP_ICON?: string;
    readonly VITE_DEFAULT_ACTIVE_PERSON?: string;
    readonly VITE_CURRENCY_SYMBOL?: string;
    readonly VITE_DESKTOP_BREAKPOINT?: string;
    readonly VITE_TOAST_DURATION_MS?: string;
    readonly VITE_QUERY_STALE_TIME_MS?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
