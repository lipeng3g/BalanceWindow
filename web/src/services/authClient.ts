import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: '/api/auth',
});

export type AuthProvider = 'github' | 'google';

export interface AuthProviderAvailability {
  github: boolean;
  google: boolean;
}

export async function fetchAuthProviders(signal?: AbortSignal): Promise<AuthProviderAvailability> {
  const response = await fetch('/api/v1/auth/providers', {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error('Unable to load authentication providers');

  const payload = await response.json() as { providers?: Partial<AuthProviderAvailability> };
  return {
    github: payload.providers?.github === true,
    google: payload.providers?.google === true,
  };
}
