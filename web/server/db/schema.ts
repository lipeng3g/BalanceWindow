import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './auth-schema';

export * from './auth-schema';

export const appMetadata = sqliteTable('app_metadata', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const userVaults = sqliteTable('user_vaults', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  revision: integer('revision').notNull().default(0),
  schemaVersion: integer('schema_version').notNull(),
  keyVersion: integer('key_version').notNull(),
  iv: text('iv').notNull(),
  ciphertext: text('ciphertext').notNull(),
  updatedAt: text('updated_at').notNull(),
});
