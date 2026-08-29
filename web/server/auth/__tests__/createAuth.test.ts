import { describe, expect, it } from 'vitest';
import {
  AuthConfigurationError,
  createAuth,
  getAuthProviderAvailability,
  type AuthBindings,
} from '../createAuth';

const database = {} as D1Database;

function createBindings(secret?: string): AuthBindings {
  return {
    DB: database,
    BETTER_AUTH_SECRET: secret,
  };
}

describe('createAuth', () => {
  it('requires an authentication secret', () => {
    expect(() => createAuth(createBindings())).toThrowError(
      new AuthConfigurationError('AUTH_SECRET_MISSING'),
    );
  });

  it('rejects secrets shorter than 32 characters', () => {
    expect(() => createAuth(createBindings('too-short'))).toThrowError(
      new AuthConfigurationError('AUTH_SECRET_TOO_SHORT'),
    );
  });

  it('creates the Better Auth handler with valid bindings', () => {
    const auth = createAuth(createBindings('local-test-secret-with-at-least-32-characters'));

    expect(auth.handler).toBeTypeOf('function');
  });

  it('enables only social providers with complete credentials', () => {
    const bindings = {
      ...createBindings('local-test-secret-with-at-least-32-characters'),
      GITHUB_CLIENT_ID: 'github-client-id',
      GITHUB_CLIENT_SECRET: 'github-client-secret',
      GOOGLE_CLIENT_ID: 'google-client-id-without-secret',
      APPLE_CLIENT_ID: 'com.lipeng4dev.BalanceWindow',
      APPLE_CLIENT_SECRET: 'apple-client-secret',
      APPLE_APP_BUNDLE_IDENTIFIER: 'com.lipeng4dev.BalanceWindow',
    };
    const auth = createAuth({
      ...bindings,
    });

    expect(auth.handler).toBeTypeOf('function');
    expect(getAuthProviderAvailability(bindings)).toEqual({
      apple: true,
      github: true,
      google: false,
    });
  });
});
