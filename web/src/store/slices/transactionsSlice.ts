import type { Money, Series, Transaction, TransactionOverrideField } from '@/types';
import { uid } from '@/utils/id';
import { expandRecurrence, extendRecurrence, MAX_OCCURRENCES, recurrenceDates, type RecurrenceInput } from '@/utils/recurrence';
import type { SliceCreator } from '../types';
import { DATA_LIMITS } from '@/config/dataLimits';
import { assertSafeMoney, normalizedEditorNote } from '@/utils/inputValidation';

export interface TransactionInput {
  accountId: string;
  date: string;
  amount: Money;
  categoryId?: string;
  note?: string;
}

export type TransactionPatch = Partial<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>>;

export type RecurringUpdateScope = 'single' | 'fromHere';

export interface RecurringUpdateOptions {
  scope?: RecurringUpdateScope;
  overwriteOverrides?: boolean;
}

export interface RecurringUpdateResult {
  updated: number;
  preserved: number;
}

export interface ExtendRecurringResult {
  added: number;
  first?: string;
  last?: string;
}

export interface ExtendRecurringPatch {
  baseAmount: Money;
  categoryId?: string;
  note?: string;
}

export interface TransactionsSlice {
  transactions: Transaction[];
  series: Series[];
  addTransaction: (input: TransactionInput) => string;
  addRecurring: (input: RecurrenceInput) => string;
  extendRecurring: (
    seriesId: string,
    count: number,
    patch?: ExtendRecurringPatch,
  ) => ExtendRecurringResult;
  updateTransaction: (id: string, patch: TransactionPatch) => void;
  updateRecurringFrom: (
    id: string,
    patch: TransactionPatch,
    options?: { overwriteOverrides?: boolean },
  ) => RecurringUpdateResult;
  removeTransaction: (id: string) => void;
  batchUpdateTransactions: (ids: string[], patch: TransactionPatch) => void;
  batchDeleteTransactions: (ids: string[]) => void;
}

/** 删除变动后，移除不再拥有任何记录的周期组，避免残留空元数据 */
function pruneEmptySeries(series: Series[], transactions: Transaction[]): Series[] {
  const used = new Set(transactions.map((t) => t.seriesId).filter(Boolean));
  return series.filter((s) => used.has(s.id));
}

export const createTransactionsSlice: SliceCreator<TransactionsSlice> = (set) => ({
  transactions: [],
  series: [],

  addTransaction: (input) => {
    assertSafeMoney(input.amount);
    const now = Date.now();
    const tx: Transaction = {
      id: uid(),
      accountId: input.accountId,
      date: input.date,
      amount: input.amount,
      categoryId: input.categoryId,
      note: normalizedEditorNote(input.note),
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ transactions: [...s.transactions, tx] }));
    return tx.id;
  },

  addRecurring: (input) => {
    assertSafeMoney(input.baseAmount);
    if (!Number.isSafeInteger(input.interval) || input.interval < 1 || input.interval > DATA_LIMITS.recurrenceInterval) {
      throw new Error('INVALID_RECURRENCE');
    }
    input = { ...input, note: normalizedEditorNote(input.note) };
    const { series, transactions } = expandRecurrence(input);
    set((s) => ({
      series: [...s.series, series],
      transactions: [...s.transactions, ...transactions],
    }));
    return series.id;
  },

  extendRecurring: (seriesId, count, patch) => {
    if (!Number.isSafeInteger(count) || count < 1 || count > MAX_OCCURRENCES) throw new Error('INVALID_RECURRENCE');
    if (patch) {
      assertSafeMoney(patch.baseAmount);
      patch = { ...patch, note: normalizedEditorNote(patch.note) };
    }
    let result: ExtendRecurringResult = { added: 0 };
    set((s) => {
      const target = s.series.find((item) => item.id === seriesId);
      if (!target) return s;

      const groupTransactions = s.transactions.filter((t) => t.seriesId === seriesId);
      const extension = extendRecurrence(target, undefined, count);
      const now = Date.now();
      const baseAmount = patch?.baseAmount ?? target.baseAmount;
      const categoryId = patch ? patch.categoryId : target.categoryId;
      const note = patch ? patch.note : target.note;
      const nextIndex = nextOccurrenceIndex(target);
      const existingIndexes = new Set(
        groupTransactions
          .map((t) => t.occurrenceIndex)
          .filter((index): index is number => typeof index === 'number' && Number.isInteger(index) && index >= 0),
      );
      // 去重按“周期序号”而不是实际日期。用户可以把一笔周期流水改到
      // 下一期的日期；这不应让真正的下一期消失或让 generatedThroughIndex 错位。
      const candidates = extension.dates.map((date, offset) => ({
        date,
        occurrenceIndex: nextIndex + offset,
      }));
      const missing = candidates.filter(({ occurrenceIndex }) => !existingIndexes.has(occurrenceIndex));
      if (!candidates.length) return s;

      const transactions: Transaction[] = missing.map(({ date, occurrenceIndex }) => ({
        id: uid(),
        accountId: target.accountId,
        date,
        amount: baseAmount,
        categoryId,
        note,
        seriesId: target.id,
        scheduledDate: date,
        occurrenceIndex,
        overrideFields: [],
        createdAt: now,
        updatedAt: now,
      }));
      result = {
        added: missing.length,
        first: missing[0]?.date,
        last: missing.at(-1)?.date,
      };

      return {
        transactions: [...s.transactions, ...transactions],
        series: s.series.map((item) =>
          item.id === seriesId
            ? {
                ...item,
                end: extension.end,
                baseAmount,
                categoryId,
                note,
                // Advance across all candidate indices, including one whose
                // actual date happens to match a manually moved transaction.
                generatedThroughIndex: nextIndex + candidates.length - 1,
              }
            : item,
        ),
      };
    });
    return result;
  },

  updateTransaction: (id, patch) => {
    patch = validatedTransactionPatch(patch);
    set((s) => ({
      transactions: s.transactions.map((t) => {
        if (t.id !== id) return t;

        // 周期组的账户由 Series 元数据定义。跨账户编辑会破坏导入校验、
        // 续期和图表关系，因此与原生 iOS 端保持一致：保留原账户，只应用其他字段。
        const safePatch = { ...patch };
        if (safePatch.accountId && t.seriesId) {
          const series = s.series.find((item) => item.id === t.seriesId);
          if (series && safePatch.accountId !== series.accountId) delete safePatch.accountId;
        }
        const overrideFields = t.seriesId
          ? mergeOverrideFields(t.overrideFields, fieldsInPatch(safePatch))
          : t.overrideFields;
        return { ...t, ...safePatch, overrideFields, updatedAt: Date.now() };
      }),
    }));
  },

  updateRecurringFrom: (id, patch, options = {}) => {
    patch = validatedTransactionPatch(patch);
    let result: RecurringUpdateResult = { updated: 0, preserved: 0 };
    const overwriteOverrides = options.overwriteOverrides ?? false;
    // “从本期开始”只传播金额、分类和备注。日期是本期的单独例外；
    // 把同一个日期写入所有后续记录会破坏原周期的时间序列。
    const fields = fieldsInPatch(patch).filter(
      (field): field is Exclude<TransactionOverrideField, 'date'> => field !== 'date',
    );
    set((s) => {
      const target = s.transactions.find((item) => item.id === id);
      if (!target?.seriesId) return s;
      const series = s.series.find((item) => item.id === target.seriesId);
      if (!series) return s;
      const pivotIndex = target.occurrenceIndex;
      const pivot = target.scheduledDate ?? target.date;
      const nextTransactions = s.transactions.map((item) => {
        if (item.seriesId !== target.seriesId) return item;
        const beforePivot = pivotIndex != null && item.occurrenceIndex != null
          ? item.occurrenceIndex < pivotIndex
          : (item.scheduledDate ?? item.date) < pivot;
        if (beforePivot) return item;
        const existingOverrides = item.overrideFields ?? [];
        const isPivot = item.id === target.id;
        // The selected occurrence is an explicit part of the user's action:
        // apply the new value to it even if it was an earlier exception. Other
        // manually adjusted occurrences remain protected by default.
        const applicable = fields.filter((field) => (
          overwriteOverrides || isPivot || !existingOverrides.includes(field)
        ));
        if (!applicable.length) {
          result.preserved += 1;
          return item;
        }
        const next = { ...item } as Transaction;
        for (const field of applicable) {
          if (Object.prototype.hasOwnProperty.call(patch, field)) {
            (next as unknown as Record<string, unknown>)[field] = (patch as unknown as Record<string, unknown>)[field];
          }
        }
        next.overrideFields = isPivot || overwriteOverrides
          ? existingOverrides.filter((field) => field === 'date' || !fields.includes(field))
          : existingOverrides;
        next.updatedAt = Date.now();
        result.updated += 1;
        return next;
      });
      const nextSeries = s.series.map((item) => {
        if (item.id !== series.id) return item;
        const next = { ...item };
        if (Object.prototype.hasOwnProperty.call(patch, 'amount') && typeof patch.amount === 'number') next.baseAmount = patch.amount;
        if (Object.prototype.hasOwnProperty.call(patch, 'categoryId')) next.categoryId = patch.categoryId;
        if (Object.prototype.hasOwnProperty.call(patch, 'note')) next.note = patch.note;
        return next;
      });
      return { transactions: nextTransactions, series: nextSeries };
    });
    return result;
  },

  removeTransaction: (id) => {
    set((s) => {
      const transactions = s.transactions.filter((t) => t.id !== id);
      return { transactions, series: pruneEmptySeries(s.series, transactions) };
    });
  },

  batchUpdateTransactions: (ids, patch) => {
    patch = validatedTransactionPatch(patch);
    const idSet = new Set(ids);
    const now = Date.now();
    set((s) => ({
      transactions: s.transactions.map((t) =>
        idSet.has(t.id)
          ? {
              ...t,
              ...patch,
              overrideFields: t.seriesId
                ? mergeOverrideFields(t.overrideFields, fieldsInPatch(patch))
                : t.overrideFields,
              updatedAt: now,
            }
          : t,
      ),
    }));
  },

  batchDeleteTransactions: (ids) => {
    const idSet = new Set(ids);
    set((s) => {
      const transactions = s.transactions.filter((t) => !idSet.has(t.id));
      return { transactions, series: pruneEmptySeries(s.series, transactions) };
    });
  },
});

function fieldsInPatch(patch: TransactionPatch): TransactionOverrideField[] {
  return (['date', 'amount', 'categoryId', 'note'] as TransactionOverrideField[])
    .filter((field) => Object.prototype.hasOwnProperty.call(patch, field));
}

function validatedTransactionPatch(patch: TransactionPatch): TransactionPatch {
  const safe = { ...patch };
  if (safe.amount != null) assertSafeMoney(safe.amount);
  if (Object.prototype.hasOwnProperty.call(safe, 'note')) safe.note = normalizedEditorNote(safe.note);
  return safe;
}

function mergeOverrideFields(
  current: TransactionOverrideField[] | undefined,
  next: TransactionOverrideField[],
): TransactionOverrideField[] {
  return [...new Set([...(current ?? []), ...next])];
}

function recurrenceDatesForSeries(series: Series): string[] {
  return recurrenceDates({
    accountId: series.accountId,
    frequency: series.frequency,
    interval: series.interval,
    baseAmount: series.baseAmount,
    startDate: series.startDate,
    end: series.end,
    categoryId: series.categoryId,
    note: series.note,
  });
}

function nextOccurrenceIndex(series: Series): number {
  if (series.generatedThroughIndex != null) {
    return Math.max(0, Math.floor(series.generatedThroughIndex) + 1);
  }
  if (series.end.kind === 'count') return Math.max(1, Math.floor(series.end.count));
  return recurrenceDatesForSeries(series).length;
}
