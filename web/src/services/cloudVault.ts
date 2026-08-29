import type { AppData } from '@/types';

export interface CloudVaultSnapshot {
  exists: true;
  revision: number;
  schemaVersion: number;
  updatedAt: string;
  data: AppData;
}

export interface EmptyCloudVault {
  exists: false;
}

export type CloudVaultResult = CloudVaultSnapshot | EmptyCloudVault;

export class CloudVaultError extends Error {
  readonly code: string;
  readonly status: number;
  readonly currentRevision?: number;

  constructor(code: string, status: number, message: string, currentRevision?: number) {
    super(message);
    this.name = 'CloudVaultError';
    this.code = code;
    this.status = status;
    this.currentRevision = currentRevision;
  }
}

export async function getCloudVault(signal?: AbortSignal): Promise<CloudVaultResult> {
  const response = await fetch('/api/v1/vault', {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    signal,
  });
  return parseResponse<CloudVaultResult>(response);
}

export async function saveCloudVault(
  data: AppData,
  expectedRevision: number,
  signal?: AbortSignal,
): Promise<{ revision: number; updatedAt: string }> {
  const response = await fetch('/api/v1/vault', {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ expectedRevision, data }),
    signal,
  });
  return parseResponse(response);
}

export async function deleteCloudVault(): Promise<void> {
  const response = await fetch('/api/v1/vault', {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  if (response.status !== 204) await parseResponse(response);
}

export async function deleteCloudAccount(): Promise<void> {
  const response = await fetch('/api/v1/account', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ confirmation: 'DELETE' }),
  });
  if (response.status !== 204) await parseResponse(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    throw new CloudVaultError(
      typeof payload?.error === 'string' ? payload.error : 'request_failed',
      response.status,
      typeof payload?.message === 'string' ? payload.message : 'Cloud data request failed',
      typeof payload?.currentRevision === 'number' ? payload.currentRevision : undefined,
    );
  }
  return payload as T;
}
