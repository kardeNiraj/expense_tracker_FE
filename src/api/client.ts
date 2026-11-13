import { ENV } from '../config';
import {
    getActiveGroupId,
    getUserToken,
    notifyUserAuthExpired,
} from '../utils/authStorage';
import {
    getActiveAdminToken,
    getDeviceIdSync,
    getDevicePlatformLabel,
    getStoredClaimedPerson,
    notifyAccessError,
} from '../utils/deviceIdentity';
import type { ApiResponse } from './types';

export const BASE_URL = ENV.API_BASE_URL;

const REQUEST_COMPRESSION_THRESHOLD_BYTES = 1024;
let activeBaseUrl = BASE_URL;
let isRequestCompressionSupported = typeof CompressionStream !== 'undefined';

function isServerlessOrNetlifyEndpoint(url: string): boolean {
    const lower = url.toLowerCase();
    return (
        lower.includes('.netlify') ||
        lower.includes('netlify.app') ||
        lower.includes('/.netlify/functions') ||
        lower.includes('lambda-url') ||
        lower.includes('execute-api')
    );
}

async function maybeCompressBody(
    body: BodyInit | null | undefined,
    targetUrl?: string
): Promise<{ body: BodyInit | null | undefined; compressed: boolean }> {
    if (!isRequestCompressionSupported || typeof body !== 'string') {
        return { body, compressed: false };
    }
    const checkUrl = targetUrl || activeBaseUrl;
    if (checkUrl && isServerlessOrNetlifyEndpoint(checkUrl)) {
        return { body, compressed: false };
    }
    if (body.length < REQUEST_COMPRESSION_THRESHOLD_BYTES) {
        return { body, compressed: false };
    }
    try {
        const stream = new Blob([body])
            .stream()
            .pipeThrough(new CompressionStream('gzip'));
        const compressedBuffer = await new Response(stream).arrayBuffer();
        if (compressedBuffer.byteLength > 0 && compressedBuffer.byteLength < body.length) {
            return { body: compressedBuffer, compressed: true };
        }
    } catch {
        isRequestCompressionSupported = false;
    }
    return { body, compressed: false };
}

export function getActiveBaseUrl(): string {
    return activeBaseUrl;
}

export class ApiError extends Error {
    status: number;
    code?: string;
    person?: string | null;
    retryAfterSeconds?: number;

    constructor(
        message: string,
        status: number,
        code?: string,
        person?: string | null,
        retryAfterSeconds?: number
    ) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.person = person;
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

async function parseErrorResponse(response: Response): Promise<ApiError> {
    const errorText = await response.text();
    let parsedMessage = errorText || response.statusText || 'Request failed';
    let code: string | undefined;
    let person: string | null | undefined;
    let retryAfterSeconds: number | undefined;

    if (errorText) {
        try {
            const json = JSON.parse(errorText) as {
                message?: string;
                error?: string;
                code?: string;
                person?: string | null;
                retryAfterSeconds?: number;
            };
            parsedMessage = json.message || json.error || parsedMessage;
            code = json.code;
            person = json.person;
            retryAfterSeconds = json.retryAfterSeconds;
        } catch {
            // Leave raw error text
        }
    }

    const err = new ApiError(parsedMessage, response.status, code, person, retryAfterSeconds);

    if (
        code === 'USER_UNAUTHORIZED' ||
        code === 'USER_NOT_FOUND' ||
        code === 'TOKEN_EXPIRED' ||
        code === 'INVALID_TOKEN' ||
        (response.status === 401 && (!code || code === 'UNAUTHORIZED'))
    ) {
        notifyUserAuthExpired();
    } else if (response.status === 401 || response.status === 403) {
        notifyAccessError({
            status: response.status,
            code,
            message: parsedMessage,
            person,
        });
    }

    return err;
}

function buildRequestHeaders(customHeaders?: HeadersInit): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-device-id': getDeviceIdSync(),
        'x-device-platform': getDevicePlatformLabel(),
    };

    const claimed = getStoredClaimedPerson();
    if (claimed) {
        headers['x-claimed-person'] = claimed;
    }

    const userToken = getUserToken();
    if (userToken) {
        headers['x-user-token'] = `Bearer ${userToken}`;
    }

    const activeGroupId = getActiveGroupId();
    if (activeGroupId) {
        headers['x-group-id'] = activeGroupId;
    }

    const adminToken = getActiveAdminToken();
    if (adminToken) {
        headers.Authorization = `Bearer ${adminToken}`;
    }

    if (customHeaders) {
        const extra = new Headers(customHeaders);
        extra.forEach((value, key) => {
            headers[key] = value;
        });
    }

    return headers;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${activeBaseUrl}${cleanEndpoint}`;
    const defaultHeaders = buildRequestHeaders(options.headers);

    const hasExplicitEncoding =
        Object.keys(defaultHeaders).some((k) => k.toLowerCase() === 'content-encoding');

    const prepared = hasExplicitEncoding
        ? { body: options.body, compressed: false }
        : await maybeCompressBody(options.body, url);

    const requestHeaders: Record<string, string> = prepared.compressed
        ? { ...defaultHeaders, 'Content-Encoding': 'gzip' }
        : defaultHeaders;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ENV.API_TIMEOUT_MS);

    try {
        let response = await fetch(url, {
            ...options,
            body: prepared.body,
            headers: requestHeaders,
            signal: options.signal || controller.signal,
        });

        // Graceful fallback if proxy/gateway rejects or fails to handle compressed request body
        if (prepared.compressed) {
            let shouldRetryUncompressed =
                response.status === 415 ||
                response.status === 502 ||
                response.status === 500;

            if (!shouldRetryUncompressed && response.status === 400) {
                try {
                    const cloned = response.clone();
                    const errJson = await cloned.json();
                    if (
                        errJson?.code === 'UNSUPPORTED_MEDIA_TYPE' ||
                        errJson?.code === 'INVALID_REQUEST_BODY' ||
                        errJson?.code === 'PAYLOAD_DECOMPRESSION_FAILED'
                    ) {
                        shouldRetryUncompressed = true;
                    }
                } catch {
                    // Ignore clone JSON parse errors
                }
            }

            if (shouldRetryUncompressed) {
                isRequestCompressionSupported = false;
                response = await fetch(url, {
                    ...options,
                    body: options.body,
                    headers: defaultHeaders,
                    signal: options.signal || controller.signal,
                });
            }
        }

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw await parseErrorResponse(response);
        }

        const json: ApiResponse<T> | T = await response.json();
        if (json && typeof json === 'object' && 'data' in json) {
            return (json as ApiResponse<T>).data;
        }
        return json as T;
    } catch (err: unknown) {
        clearTimeout(timeoutId);

        // Retry uncompressed once if CORS/proxy blocked compressed request preflight
        if (
            prepared.compressed &&
            err instanceof TypeError &&
            !options.signal?.aborted
        ) {
            const retryController = new AbortController();
            const retryTimeoutId = setTimeout(() => retryController.abort(), ENV.API_TIMEOUT_MS);
            try {
                const retryResponse = await fetch(url, {
                    ...options,
                    body: options.body,
                    headers: defaultHeaders,
                    signal: options.signal || retryController.signal,
                });
                clearTimeout(retryTimeoutId);
                // Only latch compression off once an uncompressed request proves the server is reachable
                // and only the compressed preflight/body failed (never during genuine offline TypeErrors).
                isRequestCompressionSupported = false;
                if (!retryResponse.ok) {
                    throw await parseErrorResponse(retryResponse);
                }
                const json: ApiResponse<T> | T = await retryResponse.json();
                if (json && typeof json === 'object' && 'data' in json) {
                    return (json as ApiResponse<T>).data;
                }
                return json as T;
            } catch (retryErr) {
                clearTimeout(retryTimeoutId);
                throw retryErr;
            }
        }

        // Only fallback to HTTP for local dev environments (localhost / 127.0.0.1)
        const isLocalDev = activeBaseUrl.includes('localhost') || activeBaseUrl.includes('127.0.0.1');
        if (
            isLocalDev &&
            activeBaseUrl.startsWith('https://') &&
            (err instanceof TypeError || String(err).includes('fetch'))
        ) {
            const fallbackBaseUrl = activeBaseUrl.replace(/^https:/, 'http:');
            const fallbackUrl = `${fallbackBaseUrl}${cleanEndpoint}`;
            const fallbackController = new AbortController();
            const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), ENV.API_TIMEOUT_MS);

            try {
                const fallbackResponse = await fetch(fallbackUrl, {
                    ...options,
                    body: options.body,
                    headers: defaultHeaders,
                    signal: options.signal || fallbackController.signal,
                });
                clearTimeout(fallbackTimeoutId);

                if (!fallbackResponse.ok) {
                    throw await parseErrorResponse(fallbackResponse);
                }

                // Persist the HTTP fallback only for localhost dev servers
                activeBaseUrl = fallbackBaseUrl;

                const json: ApiResponse<T> | T = await fallbackResponse.json();
                if (json && typeof json === 'object' && 'data' in json) {
                    return (json as ApiResponse<T>).data;
                }
                return json as T;
            } catch (fallbackErr) {
                clearTimeout(fallbackTimeoutId);
                throw fallbackErr;
            }
        }

        throw err;
    }
}
