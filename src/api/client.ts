import { ENV } from '../config';
import type { ApiResponse } from './types';

export const BASE_URL = ENV.API_BASE_URL;

let activeBaseUrl = BASE_URL;

export function getActiveBaseUrl(): string {
    return activeBaseUrl;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${activeBaseUrl}${cleanEndpoint}`;

    const defaultHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ENV.API_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            ...options,
            headers: defaultHeaders,
            signal: options.signal || controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error ${response.status}: ${errorText || response.statusText}`);
        }

        const json: ApiResponse<T> | T = await response.json();
        if (json && typeof json === 'object' && 'data' in json) {
            return (json as ApiResponse<T>).data;
        }
        return json as T;
    } catch (err: unknown) {
        clearTimeout(timeoutId);

        // Only fallback to HTTP for local dev environments (localhost / 127.0.0.1)
        const isLocalDev = activeBaseUrl.includes('localhost') || activeBaseUrl.includes('127.0.0.1');
        if (isLocalDev && activeBaseUrl.startsWith('https://') && (err instanceof TypeError || String(err).includes('fetch'))) {
            const fallbackBaseUrl = activeBaseUrl.replace(/^https:/, 'http:');
            const fallbackUrl = `${fallbackBaseUrl}${cleanEndpoint}`;

            const fallbackResponse = await fetch(fallbackUrl, {
                ...options,
                headers: defaultHeaders,
            });

            if (!fallbackResponse.ok) {
                const errorText = await fallbackResponse.text();
                throw new Error(
                    `API error ${fallbackResponse.status}: ${errorText || fallbackResponse.statusText}`,
                    { cause: err }
                );
            }

            // Persist the HTTP fallback only for localhost dev servers
            activeBaseUrl = fallbackBaseUrl;

            const json: ApiResponse<T> | T = await fallbackResponse.json();
            if (json && typeof json === 'object' && 'data' in json) {
                return (json as ApiResponse<T>).data;
            }
            return json as T;
        }

        throw err;
    }
}
