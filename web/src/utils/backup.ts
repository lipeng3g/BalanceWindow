import { DATA_VERSION, type AppData } from '@/types';
import { DATA_LIMITS } from '@/config/dataLimits';
import { DEFAULT_CURRENCY_CODE, currencyOption } from './money';

/** 按版本顺序执行的迁移函数：输入旧结构，输出下一版本结构 */
const migrations: Record<number, (data: AppData) => AppData> = {
  // 示例：未来从 v1 升级到 v2 时在此补充
  // 1: (data) => ({ ...data, version: 2, /* 字段变换 */ }),
};

/** 将任意来源数据迁移到当前 schema 版本 */
export function migrate(data: AppData): AppData {
  let current = data;
  while (current.version < DATA_VERSION) {
    const step = migrations[current.version];
    if (!step) throw new Error(`缺少版本 ${current.version} 的迁移函数`);
    current = step(current);
  }
  return {
    ...current,
    currencyCode: currencyOption(current.currencyCode ?? DEFAULT_CURRENCY_CODE).code,
  };
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/** 校验外部 JSON 是否为合法 AppData 结构，非法则抛错 */
export function validateAppData(value: unknown): AppData {
  if (typeof value !== 'object' || value === null) {
    throw new Error('数据格式错误：根节点不是对象');
  }
  const data = value as Record<string, unknown>;
  if (typeof data.version !== 'number') {
    throw new Error('数据格式错误：缺少 version');
  }
  if (data.version > DATA_VERSION) {
    throw new Error(`数据版本（${data.version}）高于当前支持版本（${DATA_VERSION}）`);
  }
  for (const key of ['accounts', 'transactions', 'series', 'categories'] as const) {
    if (!isArray(data[key])) throw new Error(`数据格式错误：${key} 不是数组`);
  }
  const candidate = data as unknown as AppData;
  if (!isValidAppData(candidate)) {
    throw new Error('数据格式错误：字段、日期或实体引用无效');
  }
  return candidate;
}

const MAX_OCCURRENCES = 5000;
const FREQUENCIES = new Set(['daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'annual']);

/** 与 iOS AppDataValidator 及服务端 vault 校验保持一致的完整结构校验。 */
function isValidAppData(data: AppData): boolean {
  // 早期 iOS 导出曾把缺失的可选字段编码为 null；币种缺失/null 均按默认 CNY 迁移。
  if (data.currencyCode != null && !isCurrencyCode(data.currencyCode)) return false;
  if (
    data.accounts.length > DATA_LIMITS.accounts
    || data.transactions.length > DATA_LIMITS.transactions
    || data.series.length > DATA_LIMITS.series
    || data.categories.length > DATA_LIMITS.categories
  ) return false;
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

  if (new Set(allIds).size !== allIds.length || allIds.some((id) => !isId(id))) return false;
  if (!data.categories.every((category) => (
    isId(category.id)
    && isNonEmptyString(category.name, DATA_LIMITS.entityName)
    && isNonEmptyString(category.color, DATA_LIMITS.color)
    && isTimestamp(category.createdAt)
  ))) return false;
  if (!data.accounts.every((account) => (
    isId(account.id)
    && isNonEmptyString(account.name, DATA_LIMITS.entityName)
    && isOptionalId(account.categoryId)
    && isMoney(account.openingBalance)
    && isDate(account.openingDate)
    && isNonEmptyString(account.color, DATA_LIMITS.color)
    && typeof account.archived === 'boolean'
    && isTimestamp(account.createdAt)
    && isTimestamp(account.updatedAt)
    && (account.categoryId == null || categoryIds.has(account.categoryId))
  ))) return false;
  if (!data.series.every((series) => (
    isId(series.id)
    && accountIds.has(series.accountId)
    && FREQUENCIES.has(series.frequency)
    && Number.isSafeInteger(series.interval)
    && series.interval > 0
    && series.interval <= DATA_LIMITS.recurrenceInterval
    && isMoney(series.baseAmount)
    && isDate(series.startDate)
    && isRecurrenceEnd(series.end, series.startDate)
    && isOptionalId(series.categoryId)
    && isOptionalString(series.note, DATA_LIMITS.note)
    && (series.generatedThroughIndex == null || (
      Number.isSafeInteger(series.generatedThroughIndex)
      && series.generatedThroughIndex >= -1
      && series.generatedThroughIndex <= DATA_LIMITS.occurrenceIndex
    ))
    && isTimestamp(series.createdAt)
    && (series.categoryId == null || categoryIds.has(series.categoryId))
  ))) return false;
  if (!data.transactions.every((transaction) => (
    isId(transaction.id)
    && accountIds.has(transaction.accountId)
    && isDate(transaction.date)
    && isMoney(transaction.amount)
    && isOptionalId(transaction.categoryId)
    && isOptionalString(transaction.note, DATA_LIMITS.note)
    && isOptionalId(transaction.seriesId)
    && (transaction.scheduledDate == null || isDate(transaction.scheduledDate))
    && (transaction.occurrenceIndex == null || (
      Number.isSafeInteger(transaction.occurrenceIndex)
      && transaction.occurrenceIndex >= 0
      && transaction.occurrenceIndex <= DATA_LIMITS.occurrenceIndex
    ))
    && isOverrideFields(transaction.overrideFields)
    && isTimestamp(transaction.createdAt)
    && isTimestamp(transaction.updatedAt)
    && (transaction.categoryId == null || categoryIds.has(transaction.categoryId))
    && (transaction.seriesId == null
      || (seriesIds.has(transaction.seriesId)
        && seriesById.get(transaction.seriesId)?.accountId === transaction.accountId))
  ))) return false;
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= DATA_LIMITS.entityId;
}

function isOverrideFields(value: unknown): boolean {
  if (value == null) return true;
  if (!Array.isArray(value) || value.length > 4 || new Set(value).size !== value.length) return false;
  return value.every((field) => field === 'date' || field === 'amount' || field === 'categoryId' || field === 'note');
}

function isCurrencyCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value);
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string'
    && value.trim().length > 0
    && value.length <= maxLength;
}

function isOptionalId(value: unknown): value is string | null | undefined {
  return value == null || isId(value);
}

function isOptionalString(value: unknown, maxLength: number): value is string | null | undefined {
  return value == null || (typeof value === 'string' && value.length <= maxLength);
}

function isMoney(value: unknown): value is number {
  return Number.isSafeInteger(value);
}

function isTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
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

function isRecurrenceEnd(value: unknown, startDate: string): boolean {
  if (!isRecord(value)) return false;
  if (value.kind === 'count') {
    return Number.isSafeInteger(value.count)
      && Number(value.count) >= 1
      && Number(value.count) <= MAX_OCCURRENCES
      && value.date == null;
  }
  return value.kind === 'until'
    && isDate(value.date)
    && value.date >= startDate
    && value.count == null;
}

/** 数据摘要：用于导入前预览各实体数量 */
export interface AppDataSummary {
  version: number;
  accounts: number;
  transactions: number;
  series: number;
  categories: number;
}

/** 统计各实体数量 */
export function summarize(data: AppData): AppDataSummary {
  return {
    version: data.version,
    accounts: data.accounts.length,
    transactions: data.transactions.length,
    series: data.series.length,
    categories: data.categories.length,
  };
}

/** 按 id 合并两组实体，同 id 以 incoming 为准 */
function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) map.set(item.id, item);
  return [...map.values()];
}

/** 合并两份数据：各实体按 id 去重合并，同 id 以 incoming 覆盖 */
export function mergeAppData(current: AppData, incoming: AppData): AppData {
  const incomingHasFinancialData = incoming.accounts.length > 0
    || incoming.transactions.length > 0
    || incoming.series.length > 0;
  return {
    version: DATA_VERSION,
    // An empty backup can still carry a UI currency preference; merging it
    // must not silently change the currency of an existing financial space.
    currencyCode: incomingHasFinancialData
      ? incoming.currencyCode ?? current.currencyCode ?? DEFAULT_CURRENCY_CODE
      : current.currencyCode ?? incoming.currencyCode ?? DEFAULT_CURRENCY_CODE,
    accounts: mergeById(current.accounts, incoming.accounts),
    transactions: mergeById(current.transactions, incoming.transactions),
    series: mergeById(current.series, incoming.series),
    categories: mergeById(current.categories, incoming.categories),
  };
}

/** 序列化为可下载的 JSON 字符串 */
export function serialize(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

/** 解析 JSON 字符串 → 校验 → 迁移到当前版本 */
export function deserialize(json: string): AppData {
  if (new TextEncoder().encode(json).byteLength > DATA_LIMITS.vaultBytes) {
    throw new Error('JSON 文件不能超过 4 MiB');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('JSON 解析失败：文件内容不是合法 JSON');
  }
  return migrate(validateAppData(parsed));
}

/** 浏览器端：将数据导出为 JSON 文件并触发下载 */
export function exportToFile(data: AppData, filename = 'balance-window-backup.json'): void {
  const blob = new Blob([serialize(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** 浏览器端：读取用户选择的文件并解析为 AppData */
export async function importFromFile(file: File): Promise<AppData> {
  if (file.size > DATA_LIMITS.vaultBytes) {
    throw new Error('JSON 文件不能超过 4 MiB');
  }
  const text = await file.text();
  return deserialize(text);
}
