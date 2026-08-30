import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import * as authSchema from '../db/auth-schema';

export interface AuthBindings extends Env {
  BETTER_AUTH_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_CLIENT_SECRET?: string;
  APPLE_APP_BUNDLE_IDENTIFIER?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export class AuthConfigurationError extends Error {
  readonly code: 'AUTH_SECRET_MISSING' | 'AUTH_SECRET_TOO_SHORT';

  constructor(code: AuthConfigurationError['code']) {
    super(
      code === 'AUTH_SECRET_MISSING'
        ? 'Authentication secret is missing'
        : 'Authentication secret is too short',
    );
    this.name = 'AuthConfigurationError';
    this.code = code;
  }
}

export const AUTH_FALLBACK_URL = 'https://api.balancewindow.top';
export const AUTH_TRUSTED_ORIGINS = [
  'https://balancewindow.top',
  'https://app.balancewindow.top',
  'https://api.balancewindow.top',
  'https://*.balancewindow.top',
  'http://localhost:8788',
  'http://127.0.0.1:8788',
] as const;

export function createAuth(bindings: AuthBindings) {
  const secret = requireAuthSecret(bindings.BETTER_AUTH_SECRET);
  const apple = getAppleProviderCredentials(bindings);
  const github = getProviderCredentials(bindings.GITHUB_CLIENT_ID, bindings.GITHUB_CLIENT_SECRET);
  const google = getProviderCredentials(bindings.GOOGLE_CLIENT_ID, bindings.GOOGLE_CLIENT_SECRET);

  return betterAuth({
    appName: 'Balance Window',
    baseURL: {
      allowedHosts: [
        'balancewindow.top',
        '*.balancewindow.top',
        'localhost:8788',
        '127.0.0.1:8788',
      ],
      fallback: AUTH_FALLBACK_URL,
      protocol: 'auto',
    },
    basePath: '/api/auth',
    secret,
    database: drizzleAdapter(drizzle(bindings.DB), {
      provider: 'sqlite',
      schema: authSchema,
      transaction: false,
    }),
    trustedOrigins: [...AUTH_TRUSTED_ORIGINS],
    socialProviders: {
      ...(apple ? { apple } : {}),
      ...(github ? { github } : {}),
      ...(google ? { google } : {}),
    },
    advanced: {
      cookiePrefix: 'balance-window',
    },
  });
}

export function getAuthProviderAvailability(bindings: AuthBindings) {
  return {
    apple: Boolean(getAppleProviderCredentials(bindings)),
    github: Boolean(getProviderCredentials(bindings.GITHUB_CLIENT_ID, bindings.GITHUB_CLIENT_SECRET)),
    google: Boolean(getProviderCredentials(bindings.GOOGLE_CLIENT_ID, bindings.GOOGLE_CLIENT_SECRET)),
  };
}

function getAppleProviderCredentials(bindings: AuthBindings) {
  const clientId = bindings.APPLE_CLIENT_ID?.trim();
  const clientSecret = bindings.APPLE_CLIENT_SECRET?.trim();
  const appBundleIdentifier = bindings.APPLE_APP_BUNDLE_IDENTIFIER?.trim();

  return clientId && clientSecret && appBundleIdentifier
    ? { clientId, clientSecret, appBundleIdentifier }
    : null;
}

function getProviderCredentials(clientId?: string, clientSecret?: string) {
  const normalizedClientId = clientId?.trim();
  const normalizedClientSecret = clientSecret?.trim();
  return normalizedClientId && normalizedClientSecret
    ? { clientId: normalizedClientId, clientSecret: normalizedClientSecret }
    : null;
}

function requireAuthSecret(value: string | undefined): string {
  const secret = value?.trim();

  if (!secret) {
    throw new AuthConfigurationError('AUTH_SECRET_MISSING');
  }

  if (secret.length < 32) {
    throw new AuthConfigurationError('AUTH_SECRET_TOO_SHORT');
  }

  return secret;
}
