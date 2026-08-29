import type { AppData } from '../../src/types';
import { CURRENT_KEY_VERSION, type VaultBindings } from './types';
import { parseStoredAppData } from './validation';

export class VaultConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultConfigurationError';
  }
}

export async function encryptVault(
  bindings: VaultBindings,
  userId: string,
  data: AppData,
): Promise<{ keyVersion: number; iv: string; ciphertext: string }> {
  const key = await importKey(bindings, CURRENT_KEY_VERSION);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(userId) },
    key,
    plaintext,
  );

  return {
    keyVersion: CURRENT_KEY_VERSION,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptVault(
  bindings: VaultBindings,
  userId: string,
  keyVersion: number,
  iv: string,
  ciphertext: string,
): Promise<AppData> {
  const key = await importKey(bindings, keyVersion);
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64(iv),
        additionalData: new TextEncoder().encode(userId),
      },
      key,
      fromBase64(ciphertext),
    );
    return parseStoredAppData(JSON.parse(new TextDecoder().decode(plaintext)));
  } catch (error) {
    if (error instanceof VaultConfigurationError) throw error;
    throw new Error('Unable to decrypt vault');
  }
}

async function importKey(bindings: VaultBindings, keyVersion: number): Promise<CryptoKey> {
  if (keyVersion !== CURRENT_KEY_VERSION) {
    throw new VaultConfigurationError(`Unsupported vault key version: ${keyVersion}`);
  }

  const encoded = bindings.DATA_ENCRYPTION_KEY_V1?.trim();
  if (!encoded) throw new VaultConfigurationError('Vault encryption key is missing');

  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = fromBase64(encoded);
  } catch {
    throw new VaultConfigurationError('Vault encryption key is not valid base64');
  }
  if (raw.byteLength !== 32) {
    throw new VaultConfigurationError('Vault encryption key must contain exactly 32 bytes');
  }

  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function toBase64(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    result[index] = binary.charCodeAt(index);
  }
  return result;
}
