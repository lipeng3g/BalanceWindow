import { afterEach, describe, expect, it, vi } from 'vitest';
import app, { createApp } from '../app';

const ENCRYPTION_KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));

function createDatabase(result: { ok: number } | null): D1Database {
  return {
    prepare: vi.fn(() => ({
      first: vi.fn().mockResolvedValue(result),
    })),
  } as unknown as D1Database;
}

function createVaultDatabase() {
  let vault: Record<string, unknown> | null = null;
  let deletedUserId: string | null = null;
  const deletedTables: string[] = [];

  const database = {
    prepare: vi.fn((sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: vi.fn(async () => {
          if (!sql.includes('FROM user_vaults')) return null;
          return vault && vault.user_id === args[0] ? { ...vault } : null;
        }),
        run: vi.fn(async () => {
          if (sql.startsWith('INSERT INTO user_vaults')) {
            if (vault) return { meta: { changes: 0 } };
            vault = {
              user_id: args[0], revision: args[1], schema_version: args[2], key_version: args[3],
              iv: args[4], ciphertext: args[5], updated_at: args[6],
            };
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith('UPDATE user_vaults')) {
            if (!vault || vault.user_id !== args[6] || vault.revision !== args[7]) {
              return { meta: { changes: 0 } };
            }
            vault = {
              user_id: args[6], revision: args[0], schema_version: args[1], key_version: args[2],
              iv: args[3], ciphertext: args[4], updated_at: args[5],
            };
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith('DELETE FROM user_vaults')) {
            deletedTables.push('user_vaults');
            vault = null;
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith('DELETE FROM session')) {
            deletedTables.push('session');
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith('DELETE FROM account')) {
            deletedTables.push('account');
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith('DELETE FROM user ')) {
            deletedTables.push('user');
            deletedUserId = String(args[0]);
            vault = null;
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        }),
      }),
      first: vi.fn(async () => null),
    })),
    batch: vi.fn(async (statements: Array<{ run: () => Promise<unknown> }>) => {
      for (const statement of statements) await statement.run();
      return [];
    }),
  } as unknown as D1Database;

  return {
    database,
    getVault: () => vault,
    getDeletedUserId: () => deletedUserId,
    getDeletedTables: () => deletedTables,
  };
}

function appData(note = '工资明细') {
  return {
    version: 1,
    accounts: [{
      id: 'account-1', name: '工资卡', openingBalance: 100_00, openingDate: '2026-01-01',
      color: '#1677ff', archived: false, createdAt: 1, updatedAt: 1,
    }],
    transactions: [{
      id: 'transaction-1', accountId: 'account-1', date: '2026-07-23', amount: 14_000_00,
      note, createdAt: 1, updatedAt: 1,
    }],
    series: [],
    categories: [],
  };
}

describe('Pages Functions API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns healthy when D1 responds', async () => {
    const response = await app.request('/api/v1/health', {}, { DB: createDatabase({ ok: 1 }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'ok', database: 'ok' });
  });

  it('returns degraded when D1 is unavailable', async () => {
    const database = {
      prepare: vi.fn(() => ({
        first: vi.fn().mockRejectedValue(new Error('database unavailable')),
      })),
    } as unknown as D1Database;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await app.request('/api/v1/health', {}, { DB: database });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: 'degraded',
      database: 'unavailable',
    });
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const response = await app.request('/api/v1/missing', {}, { DB: createDatabase(null) });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'not_found',
      message: 'API endpoint not found',
    });
  });

  it('fails closed when authentication secret is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await app.request('/api/auth/get-session', {}, { DB: createDatabase(null) });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'auth_unavailable',
      message: 'Authentication service is unavailable',
    });
  });

  it('does not expose legacy email authentication routes', async () => {
    const response = await app.request(
      '/api/auth/sign-up/email',
      { method: 'POST' },
      { DB: createDatabase(null) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'not_found',
      message: 'API endpoint not found',
    });
  });

  it('reports only fully configured social providers', async () => {
    const response = await app.request(
      '/api/v1/auth/providers',
      {},
      {
        DB: createDatabase(null),
        APPLE_CLIENT_ID: 'com.lipeng4dev.BalanceWindow',
        APPLE_CLIENT_SECRET: 'apple-client-secret',
        APPLE_APP_BUNDLE_IDENTIFIER: 'com.lipeng4dev.BalanceWindow',
        GITHUB_CLIENT_ID: 'github-client-id',
        GITHUB_CLIENT_SECRET: 'github-client-secret',
        GOOGLE_CLIENT_ID: 'google-client-id',
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      providers: { apple: true, github: true, google: false },
    });
    expect(response.headers.get('Cache-Control')).toContain('max-age=60');
  });

  it('requires a session for all vault requests', async () => {
    const api = createApp({ getUser: async () => null });
    const response = await api.request('/api/v1/vault', {}, {
      DB: createVaultDatabase().database,
      DATA_ENCRYPTION_KEY_V1: ENCRYPTION_KEY,
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: 'unauthorized' });
  });

  it('returns free entitlements for an authenticated user', async () => {
    const api = createApp({
      getUser: async () => ({ id: 'user-1' }),
      getEntitlements: async () => ({
        plan: 'free', maxAccounts: 2, aiEnabled: false, widgetsEnabled: false,
      }),
    });
    const response = await api.request('/api/v1/entitlements', {}, {
      DB: createVaultDatabase().database,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      plan: 'free', maxAccounts: 2, aiEnabled: false, widgetsEnabled: false,
    });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('updates the authenticated user display name without exposing another user', async () => {
    const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const first = vi.fn().mockResolvedValue({ name: 'Balance Window User', email: 'relay@example.com' });
    const database = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn(() => ({ run, first: sql.startsWith('SELECT') ? first : undefined })),
      })),
    } as unknown as D1Database;
    const api = createApp({ getUser: async () => ({ id: 'user-1' }) });

    const response = await api.request('/api/v1/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Balance Window User' }),
    }, { DB: database });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ name: 'Balance Window User', email: 'relay@example.com' });
    expect(database.prepare).toHaveBeenCalledWith('UPDATE user SET name = ? WHERE id = ?');
    expect(run).toHaveBeenCalledOnce();
  });

  it('rejects invalid display names before touching D1', async () => {
    const prepare = vi.fn();
    const api = createApp({ getUser: async () => ({ id: 'user-1' }) });
    const response = await api.request('/api/v1/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '   ' }),
    }, { DB: { prepare } as unknown as D1Database });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_profile' });
    expect(prepare).not.toHaveBeenCalled();
  });

  it('encrypts a new vault and decrypts it for the same user', async () => {
    const state = createVaultDatabase();
    const api = createApp({ getUser: async () => ({ id: 'user-1' }) });
    const bindings = { DB: state.database, DATA_ENCRYPTION_KEY_V1: ENCRYPTION_KEY };

    const saved = await api.request('/api/v1/vault', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 0, data: appData() }),
    }, bindings);
    expect(saved.status).toBe(200);
    await expect(saved.json()).resolves.toMatchObject({ revision: 1 });
    expect(JSON.stringify(state.getVault())).not.toContain('工资明细');
    expect(state.getVault()).toMatchObject({ revision: 1, schema_version: 1, key_version: 1 });

    const loaded = await api.request('/api/v1/vault', {}, bindings);
    expect(loaded.status).toBe(200);
    await expect(loaded.json()).resolves.toMatchObject({
      exists: true,
      revision: 1,
      data: { transactions: [{ note: '工资明细' }] },
    });
    expect(loaded.headers.get('Cache-Control')).toBe('no-store');
  });

  it('rejects stale revisions without overwriting the encrypted vault', async () => {
    const state = createVaultDatabase();
    const api = createApp({ getUser: async () => ({ id: 'user-1' }) });
    const bindings = { DB: state.database, DATA_ENCRYPTION_KEY_V1: ENCRYPTION_KEY };
    const put = (expectedRevision: number, note: string) => api.request('/api/v1/vault', {
      method: 'PUT',
      body: JSON.stringify({ expectedRevision, data: appData(note) }),
    }, bindings);

    expect((await put(0, '版本一')).status).toBe(200);
    expect((await put(1, '版本二')).status).toBe(200);
    const conflict = await put(1, '过期设备');
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({
      error: 'revision_conflict', currentRevision: 2,
    });

    const loaded = await api.request('/api/v1/vault', {}, bindings);
    const payload = await loaded.json() as { data: { transactions: Array<{ note: string }> } };
    expect(payload.data.transactions[0].note).toBe('版本二');
  });

  it('validates vault structure and explicit account deletion confirmation', async () => {
    const state = createVaultDatabase();
    const api = createApp({ getUser: async () => ({ id: 'user-1' }) });
    const bindings = { DB: state.database, DATA_ENCRYPTION_KEY_V1: ENCRYPTION_KEY };

    const invalid = await api.request('/api/v1/vault', {
      method: 'PUT',
      body: JSON.stringify({ expectedRevision: 0, data: { version: 1 } }),
    }, bindings);
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({ error: 'invalid_vault' });

    const unconfirmed = await api.request('/api/v1/account', { method: 'DELETE' }, bindings);
    expect(unconfirmed.status).toBe(400);
    expect(state.getDeletedUserId()).toBeNull();

    const deleted = await api.request('/api/v1/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'DELETE' }),
    }, bindings);
    expect(deleted.status).toBe(204);
    expect(state.getDeletedUserId()).toBe('user-1');
    expect(state.getDeletedTables()).toEqual(['user_vaults', 'session', 'account', 'user']);
  });

  it('rejects invalid calendar dates and dangling vault references', async () => {
    const state = createVaultDatabase();
    const api = createApp({ getUser: async () => ({ id: 'user-1' }) });
    const bindings = { DB: state.database, DATA_ENCRYPTION_KEY_V1: ENCRYPTION_KEY };

    const invalidDate = appData();
    invalidDate.transactions[0].date = '2026-02-30';
    const dateResponse = await api.request('/api/v1/vault', {
      method: 'PUT',
      body: JSON.stringify({ expectedRevision: 0, data: invalidDate }),
    }, bindings);
    expect(dateResponse.status).toBe(400);

    const dangling = appData();
    dangling.transactions[0].accountId = 'missing-account';
    const referenceResponse = await api.request('/api/v1/vault', {
      method: 'PUT',
      body: JSON.stringify({ expectedRevision: 0, data: dangling }),
    }, bindings);
    expect(referenceResponse.status).toBe(400);
    expect(state.getVault()).toBeNull();
  });

  it('rejects oversized vault fields and out-of-range recurrence metadata', async () => {
    const state = createVaultDatabase();
    const api = createApp({ getUser: async () => ({ id: 'user-1' }) });
    const bindings = { DB: state.database, DATA_ENCRYPTION_KEY_V1: ENCRYPTION_KEY };

    const oversizedName = appData();
    oversizedName.accounts[0].name = 'a'.repeat(201);
    const nameResponse = await api.request('/api/v1/vault', {
      method: 'PUT',
      body: JSON.stringify({ expectedRevision: 0, data: oversizedName }),
    }, bindings);
    expect(nameResponse.status).toBe(400);

    const invalidOccurrence = appData();
    invalidOccurrence.transactions[0] = {
      ...invalidOccurrence.transactions[0],
      occurrenceIndex: 1_000_001,
    } as typeof invalidOccurrence.transactions[0];
    const occurrenceResponse = await api.request('/api/v1/vault', {
      method: 'PUT',
      body: JSON.stringify({ expectedRevision: 0, data: invalidOccurrence }),
    }, bindings);
    expect(occurrenceResponse.status).toBe(400);
    expect(state.getVault()).toBeNull();
  });

  it('accepts null optional fields from older iOS exports', async () => {
    const state = createVaultDatabase();
    const api = createApp({ getUser: async () => ({ id: 'user-1' }) });
    const data = JSON.parse(JSON.stringify(appData())) as {
      transactions: Array<Record<string, unknown>>;
    };
    data.transactions[0].categoryId = null;
    data.transactions[0].note = null;
    data.transactions[0].seriesId = null;
    const response = await api.request('/api/v1/vault', {
      method: 'PUT',
      body: JSON.stringify({ expectedRevision: 0, data }),
    }, { DB: state.database, DATA_ENCRYPTION_KEY_V1: ENCRYPTION_KEY });

    expect(response.status).toBe(200);
  });

  it('rejects a free vault containing more than two financial accounts', async () => {
    const state = createVaultDatabase();
    const api = createApp({
      getUser: async () => ({ id: 'user-1' }),
      getEntitlements: async () => ({
        plan: 'free', maxAccounts: 2, aiEnabled: false, widgetsEnabled: false,
      }),
    });
    const data = appData();
    data.accounts = [
      data.accounts[0],
      { ...data.accounts[0], id: 'account-2', name: '现金' },
      { ...data.accounts[0], id: 'account-3', name: '理财' },
    ];

    const response = await api.request('/api/v1/vault', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 0, data }),
    }, { DB: state.database, DATA_ENCRYPTION_KEY_V1: ENCRYPTION_KEY });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'account_limit_reached',
      message: 'This plan supports up to 2 accounts',
      maxAccounts: 2,
    });
    expect(state.getVault()).toBeNull();
  });
});
