import { Hono, type Context } from 'hono';
import {
  AuthConfigurationError,
  createAuth,
  getAuthProviderAvailability,
  type AuthBindings,
} from './auth/createAuth';
import { getAuthenticatedUser, type AuthenticatedUser } from './auth/session';
import { decryptVault, encryptVault, VaultConfigurationError } from './vault/crypto';
import { CURRENT_DATA_VERSION, type StoredVault, type VaultBindings } from './vault/types';
import { parseVaultWriteRequest, VaultValidationError } from './vault/validation';
import { getFreeEntitlements, type Entitlements } from './entitlements';

type AppBindings = AuthBindings & VaultBindings;

interface AppDependencies {
  getUser: (bindings: AppBindings, headers: Headers) => Promise<AuthenticatedUser | null>;
  getEntitlements: (bindings: AppBindings, userId: string) => Promise<Entitlements>;
}

const defaultDependencies: AppDependencies = {
  getUser: getAuthenticatedUser,
  getEntitlements: async () => getFreeEntitlements(),
};

export function createApp(overrides: Partial<AppDependencies> = {}) {
  const dependencies: AppDependencies = { ...defaultDependencies, ...overrides };
  const app = new Hono<{ Bindings: AppBindings }>();

  app.on(['GET', 'POST'], '/api/auth/*', async (context) => {
  if (isLegacyEmailAuthPath(new URL(context.req.url).pathname)) {
    return context.json({ error: 'not_found', message: 'API endpoint not found' }, 404);
  }

  try {
    return await createAuth(context.env).handler(context.req.raw);
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      console.error('Authentication service is not configured', { code: error.code });
      return context.json(
        { error: 'auth_unavailable', message: 'Authentication service is unavailable' },
        503,
      );
    }

    throw error;
  }
  });

function isLegacyEmailAuthPath(pathname: string): boolean {
  return pathname.startsWith('/api/auth/reset-password') || [
    '/api/auth/sign-up/email',
    '/api/auth/sign-in/email',
    '/api/auth/request-password-reset',
    '/api/auth/send-verification-email',
    '/api/auth/verify-email',
    '/api/auth/change-email',
  ].includes(pathname);
}

  app.get('/api/v1/auth/providers', (context) => {
  const providers = getAuthProviderAvailability(context.env);
  return context.json({ providers }, 200, {
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
  });
  });

  app.get('/api/v1/health', async (context) => {
  const checkedAt = new Date().toISOString();

  try {
    const result = await context.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();

    if (result?.ok !== 1) {
      return context.json(
        { status: 'degraded', database: 'unexpected-response', checkedAt },
        503,
      );
    }

    return context.json({ status: 'ok', database: 'ok', checkedAt });
  } catch (error) {
    console.error(
      'D1 health check failed',
      error instanceof Error ? { name: error.name, message: error.message } : { name: 'UnknownError' },
    );

    return context.json({ status: 'degraded', database: 'unavailable', checkedAt }, 503);
  }
  });

  app.get('/api/v1/entitlements', async (context) => {
    const user = await requireUser(context.env, context.req.raw.headers, dependencies);
    if (user instanceof Response) return user;

    const entitlements = await dependencies.getEntitlements(context.env, user.id);
    return context.json(entitlements, 200, noStoreHeaders());
  });

  app.patch('/api/v1/profile', async (context) => {
    const user = await requireUser(context.env, context.req.raw.headers, dependencies);
    if (user instanceof Response) return user;

    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      body = null;
    }
    const name = normalizeProfileName(body);
    if (!name) {
      return context.json({
        error: 'invalid_profile',
        message: 'Display name must contain 1 to 80 characters',
      }, 400, noStoreHeaders());
    }

    await context.env.DB.prepare('UPDATE user SET name = ? WHERE id = ?')
      .bind(name, user.id)
      .run();
    const updated = await context.env.DB.prepare('SELECT name, email FROM user WHERE id = ?')
      .bind(user.id)
      .first<{ name: string; email: string }>();
    return context.json({
      name: updated?.name ?? name,
      email: updated?.email ?? null,
    }, 200, noStoreHeaders());
  });

  app.get('/api/v1/vault', async (context) => {
    const user = await requireUser(context.env, context.req.raw.headers, dependencies);
    if (user instanceof Response) return user;

    const row = await readStoredVault(context.env.DB, user.id);
    if (!row) {
      return context.json({ exists: false }, 200, noStoreHeaders());
    }

    try {
      const data = await decryptVault(
        context.env,
        user.id,
        row.key_version,
        row.iv,
        row.ciphertext,
      );
      return context.json({
        exists: true,
        revision: row.revision,
        schemaVersion: row.schema_version,
        updatedAt: row.updated_at,
        data,
      }, 200, noStoreHeaders());
    } catch (error) {
      return handleVaultFailure(context, error);
    }
  });

  app.put('/api/v1/vault', async (context) => {
    const user = await requireUser(context.env, context.req.raw.headers, dependencies);
    if (user instanceof Response) return user;

    let request;
    try {
      request = parseVaultWriteRequest(await context.req.text());
    } catch (error) {
      if (error instanceof VaultValidationError) {
        return context.json({ error: 'invalid_vault', message: error.message }, 400, noStoreHeaders());
      }
      throw error;
    }

    const entitlements = await dependencies.getEntitlements(context.env, user.id);
    if (
      entitlements.maxAccounts !== null
      && request.data.accounts.length > entitlements.maxAccounts
    ) {
      return context.json({
        error: 'account_limit_reached',
        message: `This plan supports up to ${entitlements.maxAccounts} accounts`,
        maxAccounts: entitlements.maxAccounts,
      }, 403, noStoreHeaders());
    }

    const current = await readStoredVault(context.env.DB, user.id);
    const currentRevision = current?.revision ?? 0;
    if (request.expectedRevision !== currentRevision) {
      return context.json({
        error: 'revision_conflict',
        currentRevision,
        updatedAt: current?.updated_at ?? null,
      }, 409, noStoreHeaders());
    }

    try {
      const encrypted = await encryptVault(context.env, user.id, request.data);
      const updatedAt = new Date().toISOString();
      const nextRevision = currentRevision + 1;
      const saved = current
        ? await context.env.DB.prepare(
          `UPDATE user_vaults
             SET revision = ?, schema_version = ?, key_version = ?, iv = ?, ciphertext = ?, updated_at = ?
           WHERE user_id = ? AND revision = ?`,
        )
          .bind(
            nextRevision,
            CURRENT_DATA_VERSION,
            encrypted.keyVersion,
            encrypted.iv,
            encrypted.ciphertext,
            updatedAt,
            user.id,
            currentRevision,
          )
          .run()
        : await context.env.DB.prepare(
          `INSERT INTO user_vaults
            (user_id, revision, schema_version, key_version, iv, ciphertext, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id) DO NOTHING`,
        )
          .bind(
            user.id,
            nextRevision,
            CURRENT_DATA_VERSION,
            encrypted.keyVersion,
            encrypted.iv,
            encrypted.ciphertext,
            updatedAt,
          )
          .run();

      if ((saved.meta.changes ?? 0) !== 1) {
        const latest = await readStoredVault(context.env.DB, user.id);
        return context.json({
          error: 'revision_conflict',
          currentRevision: latest?.revision ?? 0,
          updatedAt: latest?.updated_at ?? null,
        }, 409, noStoreHeaders());
      }

      return context.json({ revision: nextRevision, updatedAt }, 200, noStoreHeaders());
    } catch (error) {
      return handleVaultFailure(context, error);
    }
  });

  app.delete('/api/v1/vault', async (context) => {
    const user = await requireUser(context.env, context.req.raw.headers, dependencies);
    if (user instanceof Response) return user;
    await context.env.DB.prepare('DELETE FROM user_vaults WHERE user_id = ?').bind(user.id).run();
    return context.body(null, 204, noStoreHeaders());
  });

  app.delete('/api/v1/account', async (context) => {
    const user = await requireUser(context.env, context.req.raw.headers, dependencies);
    if (user instanceof Response) return user;

    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      body = null;
    }
    if (!isDeleteConfirmation(body)) {
      return context.json(
        { error: 'confirmation_required', message: 'Account deletion requires explicit confirmation' },
        400,
        noStoreHeaders(),
      );
    }

    // Keep account deletion explicit and atomic instead of relying solely on
    // D1's foreign-key cascade. This guarantees that old sessions and the
    // encrypted vault are removed even if a deployment's PRAGMA settings
    // differ, and makes the deletion contract auditable in tests.
    await context.env.DB.batch([
      context.env.DB.prepare('DELETE FROM user_vaults WHERE user_id = ?').bind(user.id),
      context.env.DB.prepare('DELETE FROM session WHERE user_id = ?').bind(user.id),
      context.env.DB.prepare('DELETE FROM account WHERE user_id = ?').bind(user.id),
      context.env.DB.prepare('DELETE FROM user WHERE id = ?').bind(user.id),
    ]);
    return context.body(null, 204, noStoreHeaders());
  });

  app.notFound((context) =>
    context.json({ error: 'not_found', message: 'API endpoint not found' }, 404),
  );

  return app;
}

async function requireUser(
  bindings: AppBindings,
  headers: Headers,
  dependencies: AppDependencies,
): Promise<AuthenticatedUser | Response> {
  try {
    const user = await dependencies.getUser(bindings, headers);
    return user ?? Response.json(
      { error: 'unauthorized', message: 'Authentication required' },
      { status: 401, headers: noStoreHeaders() },
    );
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      console.error('Authentication service is not configured', { code: error.code });
      return Response.json(
        { error: 'auth_unavailable', message: 'Authentication service is unavailable' },
        { status: 503, headers: noStoreHeaders() },
      );
    }
    throw error;
  }
}

async function readStoredVault(database: D1Database, userId: string): Promise<StoredVault | null> {
  return database.prepare(
    `SELECT user_id, revision, schema_version, key_version, iv, ciphertext, updated_at
       FROM user_vaults WHERE user_id = ?`,
  ).bind(userId).first<StoredVault>();
}

function handleVaultFailure(
  context: Context<{ Bindings: AppBindings }>,
  error: unknown,
): Response {
  if (error instanceof VaultConfigurationError) {
    console.error('Vault encryption is not configured', { name: error.name, message: error.message });
    return context.json(
      { error: 'vault_unavailable', message: 'Cloud data storage is unavailable' },
      503,
      noStoreHeaders(),
    );
  }
  console.error('Vault operation failed', error instanceof Error ? { name: error.name } : { name: 'UnknownError' });
  return context.json(
    { error: 'vault_unavailable', message: 'Cloud data storage is unavailable' },
    503,
    noStoreHeaders(),
  );
}

function noStoreHeaders(): Record<string, string> {
  return { 'Cache-Control': 'no-store' };
}

function isDeleteConfirmation(value: unknown): boolean {
  return typeof value === 'object'
    && value !== null
    && 'confirmation' in value
    && value.confirmation === 'DELETE';
}

function normalizeProfileName(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('name' in value)) return null;
  const candidate = (value as { name?: unknown }).name;
  if (typeof candidate !== 'string') return null;
  const name = candidate.trim();
  if (!name || name.length > 80) return null;
  if ([...name].some((character) => /\p{C}/u.test(character))) return null;
  return name;
}

const app = createApp();

export default app;
