import type { AppData } from '../../src/types';
import { DATA_LIMITS } from '../../src/config/dataLimits';
import { CURRENT_DATA_VERSION, MAX_VAULT_BYTES, type VaultWriteRequest } from './types';

export class VaultValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultValidationError';
  }
}

const MAX_OCCURRENCES = 5000;

export function parseVaultWriteRequest(text: string): VaultWriteRequest {
  if (new TextEncoder().encode(text).byteLength > MAX_VAULT_BYTES) {
    throw new VaultValidationError('Vault payload is too large');
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new VaultValidationError('Request body is not valid JSON');
  }

  if (
    !isRecord(value)
    || typeof value.expectedRevision !== 'number'
    || !Number.isSafeInteger(value.expectedRevision)
    || value.expectedRevision < 0
  ) {
    throw new VaultValidationError('expectedRevision must be a non-negative integer');
  }
  if (!isAppData(value.data)) {
    throw new VaultValidationError('Vault data has an invalid structure');
  }

  return value as unknown as VaultWriteRequest;
}

export function parseStoredAppData(value: unknown): AppData {
  if (!isAppData(value)) throw new VaultValidationError('Stored vault data has an invalid structure');
  return value;
}

function isAppData(value: unknown): value is AppData {
  if (!isRecord(value) || value.version !== CURRENT_DATA_VERSION) return false;
  if (!Array.isArray(value.accounts) || !value.accounts.every(isAccount)) return false;
  if (!Array.isArray(value.transactions) || !value.transactions.every(isTransaction)) return false;
  if (!Array.isArray(value.series) || !value.series.every(isSeries)) return false;
  if (!Array.isArray(value.categories) || !value.categories.every(isCategory)) return false;
  if (
    value.accounts.length > DATA_LIMITS.accounts
    || value.transactions.length > DATA_LIMITS.transactions
    || value.series.length > DATA_LIMITS.series
    || value.categories.length > DATA_LIMITS.categories
  ) return false;

  const data = value as unknown as AppData;
  const accountIds = new Set(data.accounts.map((account) => account.id));
  const categoryIds = new Set(data.categories.map((category) => category.id));
  const seriesIds = new Set(data.series.map((series) => series.id));
  const seriesById = new Map(data.series.map((series) => [series.id, series]));
  const allIds = [
    ...data.accounts.map((item) => item.id),
    ...data.transactions.map((item) => item.id),
    ...data.series.map((item) => item.id),
    ...data.categories.map((item) => item.id),
  ];
  if (new Set(allIds).size !== allIds.length) return false;

  return data.accounts.every((account) => (
    (account.categoryId == null || categoryIds.has(account.categoryId))
  )) && data.series.every((series) => (
    accountIds.has(series.accountId)
    && (series.categoryId == null || categoryIds.has(series.categoryId))
  )) && data.transactions.every((transaction) => (
    accountIds.has(transaction.accountId)
    && (transaction.categoryId == null || categoryIds.has(transaction.categoryId))
    && (transaction.seriesId == null
      || (seriesIds.has(transaction.seriesId)
        && seriesById.get(transaction.seriesId)?.accountId === transaction.accountId))
  ));
}

function isAccount(value: unknown): boolean {
  return isRecord(value)
    && isId(value.id)
    && isNonEmptyString(value.name, DATA_LIMITS.entityName)
    && isOptionalId(value.categoryId)
    && isMoney(value.openingBalance)
    && isDate(value.openingDate)
    && isNonEmptyString(value.color, DATA_LIMITS.color)
    && typeof value.archived === 'boolean'
    && isTimestamp(value.createdAt)
    && isTimestamp(value.updatedAt);
}

function isTransaction(value: unknown): boolean {
  return isRecord(value)
    && isId(value.id)
    && isId(value.accountId)
    && isDate(value.date)
    && isMoney(value.amount)
    && isOptionalId(value.categoryId)
    && isOptionalString(value.note, DATA_LIMITS.note)
    && isOptionalId(value.seriesId)
    && (value.scheduledDate == null || isDate(value.scheduledDate))
    && (value.occurrenceIndex == null || (
      Number.isSafeInteger(value.occurrenceIndex)
      && Number(value.occurrenceIndex) >= 0
      && Number(value.occurrenceIndex) <= DATA_LIMITS.occurrenceIndex
    ))
    && isOverrideFields(value.overrideFields)
    && isTimestamp(value.createdAt)
    && isTimestamp(value.updatedAt);
}

function isSeries(value: unknown): boolean {
  return isRecord(value)
    && isId(value.id)
    && isId(value.accountId)
    && ['daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'annual'].includes(String(value.frequency))
    && Number.isSafeInteger(value.interval)
    && Number(value.interval) > 0
    && Number(value.interval) <= DATA_LIMITS.recurrenceInterval
    && isMoney(value.baseAmount)
    && isDate(value.startDate)
    && isRecurrenceEnd(value.end, value.startDate)
    && isOptionalId(value.categoryId)
    && isOptionalString(value.note, DATA_LIMITS.note)
    && (value.generatedThroughIndex == null || (
      Number.isSafeInteger(value.generatedThroughIndex)
      && Number(value.generatedThroughIndex) >= -1
      && Number(value.generatedThroughIndex) <= DATA_LIMITS.occurrenceIndex
    ))
    && isTimestamp(value.createdAt);
}

function isCategory(value: unknown): boolean {
  return isRecord(value)
    && isId(value.id)
    && isNonEmptyString(value.name, DATA_LIMITS.entityName)
    && isNonEmptyString(value.color, DATA_LIMITS.color)
    && isTimestamp(value.createdAt);
}

function isRecurrenceEnd(value: unknown, startDate: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.kind === 'count') {
    return Number.isSafeInteger(value.count)
      && Number(value.count) >= 1
      && Number(value.count) <= MAX_OCCURRENCES
      && value.date == null;
  }
  if (value.kind !== 'until' || value.count != null) return false;
  const endDate = value.date;
  if (!isDate(endDate) || !isDate(startDate)) return false;
  return endDate >= startDate;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return isShortString(value, DATA_LIMITS.entityId) && value.length > 0;
}

function isOverrideFields(value: unknown): boolean {
  if (value == null) return true;
  if (!Array.isArray(value) || value.length > 4 || new Set(value).size !== value.length) return false;
  return value.every((field) => field === 'date' || field === 'amount' || field === 'categoryId' || field === 'note');
}

function isOptionalId(value: unknown): boolean {
  return value == null || isId(value);
}

function isShortString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max;
}

function isNonEmptyString(value: unknown, max: number): value is string {
  return isShortString(value, max) && value.trim().length > 0;
}

function isOptionalString(value: unknown, max: number): boolean {
  return value == null || isShortString(value, max);
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function isMoney(value: unknown): boolean {
  return Number.isSafeInteger(value);
}

function isTimestamp(value: unknown): boolean {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}
