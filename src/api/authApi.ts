import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type {
    AuthConfigResponse,
    AuthMeResponse,
    AuthResponse,
    AuthUser,
    ForgotPasswordPayload,
    ForgotPasswordResponse,
    GoogleAuthPayload,
    LoginEmailPayload,
    PinAuthPayload,
    RegisterEmailPayload,
    ResetPasswordPayload,
    UpdateMePayload,
} from './types';
import { getUserToken } from '../utils/authStorage';

export const authQueryKeys = {
    config: () => ['auth', 'config'] as const,
    me: () => ['auth', 'me'] as const,
};

export async function fetchAuthConfigApi(): Promise<AuthConfigResponse> {
    return apiFetch<AuthConfigResponse>('/auth/config');
}

export async function registerWithEmailApi(payload: RegisterEmailPayload): Promise<AuthResponse> {
    return apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function loginWithEmailApi(payload: LoginEmailPayload): Promise<AuthResponse> {
    return apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function authenticateWithGoogleApi(payload: GoogleAuthPayload): Promise<AuthResponse> {
    return apiFetch<AuthResponse>('/auth/google', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function authenticateWithPinApi(payload: PinAuthPayload): Promise<AuthResponse> {
    return apiFetch<AuthResponse>('/auth/pin', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function forgotPasswordApi(
    payload: ForgotPasswordPayload
): Promise<ForgotPasswordResponse> {
    return apiFetch<ForgotPasswordResponse>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function resetPasswordApi(payload: ResetPasswordPayload): Promise<AuthResponse> {
    return apiFetch<AuthResponse>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function fetchAuthMeApi(): Promise<AuthMeResponse> {
    const raw = await apiFetch<
        | AuthMeResponse
        | {
              user?:
                  | AuthUser
                  | {
                        user?: AuthUser;
                        groups?: AuthMeResponse['groups'];
                        formerGroups?: AuthMeResponse['formerGroups'];
                    };
              groups?: AuthMeResponse['groups'];
              formerGroups?: AuthMeResponse['formerGroups'];
          }
    >('/auth/me');

    const candidateUser = raw?.user as
        | (AuthUser & { user?: undefined })
        | {
              user?: AuthUser;
              groups?: AuthMeResponse['groups'];
              formerGroups?: AuthMeResponse['formerGroups'];
          }
        | undefined;

    if (candidateUser && !('userId' in candidateUser) && candidateUser.user?.userId) {
        return {
            user: candidateUser.user,
            groups: Array.isArray(raw?.groups) ? raw.groups : candidateUser.groups || [],
            formerGroups: Array.isArray(raw?.formerGroups)
                ? raw.formerGroups
                : candidateUser.formerGroups || [],
        };
    }

    return raw as AuthMeResponse;
}

export async function updateAuthMeApi(payload: UpdateMePayload): Promise<{ user: AuthUser }> {
    return apiFetch<{ user: AuthUser }>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

export function useAuthConfig(enabled = true) {
    return useQuery<AuthConfigResponse>({
        queryKey: authQueryKeys.config(),
        queryFn: fetchAuthConfigApi,
        enabled,
        staleTime: 1000 * 60 * 10,
        networkMode: 'online',
        retry: 1,
    });
}

export function useAuthMe(enabled = true) {
    return useQuery<AuthMeResponse>({
        queryKey: authQueryKeys.me(),
        queryFn: fetchAuthMeApi,
        enabled: enabled && Boolean(getUserToken()),
        staleTime: 1000 * 30,
        networkMode: 'online',
        retry: 1,
    });
}

export function useUpdateProfileMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateAuthMeApi,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: authQueryKeys.me() });
        },
    });
}

