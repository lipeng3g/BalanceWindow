import { describe, expect, it } from 'vitest';
import { decryptVault, encryptVault, VaultConfigurationError } from '../crypto';

const data = { version: 1, accounts: [], transactions: [], series: [], categories: [] };
const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(19)));

describe('vault encryption', () => {
  it('round-trips valid AppData with the same user as authenticated data', async () => {
    const encrypted = await encryptVault({ DATA_ENCRYPTION_KEY_V1: key }, 'user-1', data);
    await expect(decryptVault(
      { DATA_ENCRYPTION_KEY_V1: key },
      'user-1',
      encrypted.keyVersion,
      encrypted.iv,
      encrypted.ciphertext,
    )).resolves.toEqual(data);
  });

  it('cannot decrypt another user\'s vault', async () => {
    const encrypted = await encryptVault({ DATA_ENCRYPTION_KEY_V1: key }, 'user-1', data);
    await expect(decryptVault(
      { DATA_ENCRYPTION_KEY_V1: key },
      'user-2',
      encrypted.keyVersion,
      encrypted.iv,
      encrypted.ciphertext,
    )).rejects.toThrow('Unable to decrypt vault');
  });

  it('fails closed when the encryption key is missing or malformed', async () => {
    await expect(encryptVault({}, 'user-1', data)).rejects.toBeInstanceOf(VaultConfigurationError);
    await expect(encryptVault({ DATA_ENCRYPTION_KEY_V1: btoa('too-short') }, 'user-1', data))
      .rejects.toThrow('exactly 32 bytes');
  });
});
