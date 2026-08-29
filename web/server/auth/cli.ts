import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';

/**
 * Schema-generation-only configuration.
 * Runtime authentication is created from request bindings in createAuth.ts.
 */
export const auth = betterAuth({
  appName: 'Balance Window',
  database: drizzleAdapter(drizzle({} as D1Database), {
    provider: 'sqlite',
  }),
});
