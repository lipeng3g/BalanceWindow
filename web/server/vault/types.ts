import type { AppData } from '../../src/types';
import { DATA_LIMITS } from '../../src/config/dataLimits';

export const MAX_VAULT_BYTES = DATA_LIMITS.vaultBytes;
export const CURRENT_DATA_VERSION = 1;
export const CURRENT_KEY_VERSION = 1;

export interface VaultBindings {
  DATA_ENCRYPTION_KEY_V1?: string;
}

export interface StoredVault {
  user_id: string;
  revision: number;
  schema_version: number;
  key_version: number;
  iv: string;
  ciphertext: string;
  updated_at: string;
}

export interface VaultWriteRequest {
  expectedRevision: number;
  data: AppData;
}
