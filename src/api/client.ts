import type { ApiResponse } from './types';

export const BASE_URL = 'https://localhost:8081';
export const FALLBACK_URL = 'http://localhost:8081';

let activeBaseUrl = BASE_URL;

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${activeBaseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const defaultHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    try {
        const response = await fetch(url, {
            ...options,
            headers: defaultHeaders,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error ${response.status}: ${errorText || response.statusText}`);
        }

        const json: ApiResponse<T> | T = await response.json();
        // Check if response is wrapped in { success, data }
        if (json && typeof json === 'object' && 'data' in json) {
            return (json as ApiResponse<T>).data;
        }
        return json as T;
    } catch (err: unknown) {
        // If HTTPS fails due to local dev server running plain HTTP, switch to fallback
        if (activeBaseUrl === BASE_URL && (err instanceof TypeError || String(err).includes('fetch'))) {
            activeBaseUrl = FALLBACK_URL;
            const fallbackUrl = `${activeBaseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
            const fallbackResponse = await fetch(fallbackUrl, {
                ...options,
                headers: defaultHeaders,
            });

            if (!fallbackResponse.ok) {
                const errorText = await fallbackResponse.text();
                throw new Error(`API error ${fallbackResponse.status}: ${errorText || fallbackResponse.statusText}`, { cause: err });
            }

            const json: ApiResponse<T> | T = await fallbackResponse.json();
            if (json && typeof json === 'object' && 'data' in json) {
                return (json as ApiResponse<T>).data;
            }
            return json as T;
        }

        throw err;
    }
}
