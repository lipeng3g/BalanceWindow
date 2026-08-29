import type { Frequency, Money, RecurrenceEnd, Series, Transaction } from '@/types';
import { isSameOrBeforeDate, stepDate } from './date';
import { uid } from './id';

/** 单次周期展开的最大生成笔数，防止误设导致卡死 */
export const MAX_OCCURRENCES = 5000;

/** 频率中文标签 */
export const FREQUENCY_LABELS: Record<Frequency, string> = {
  once: '一次性',
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
  quarterly: '每季度',
  semiannual: '每半年',
  annual: '每年',
};

/** 周期配置下拉中的无歧义单位表达 */
export const FREQUENCY_OPTION_LABELS: Record<Frequency, string> = {
  once: '一次性',
  daily: '按天',
  weekly: '按周',
  monthly: '按月',
  quarterly: '按季度',
  semiannual: '按半年',
  annual: '按年',
};

/** 与「每 N ___ 一次」组合使用的单位 */
export const FREQUENCY_INTERVAL_UNITS: Record<Frequency, string> = {
  once: '次',
  daily: '天',
  weekly: '周',
  monthly: '个月',
  quarterly: '个季度',
  semiannual: '个半年',
  annual: '年',
};

/** 例如「每 1 个月一次」「每 2 个季度一次」 */
export function formatRecurrenceRule(
  frequency: Frequency,
  interval: number,
  translate?: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (frequency === 'once') return translate ? translate('frequency.once') : FREQUENCY_LABELS.once;
  const safeInterval = Math.max(1, Math.floor(interval));
  if (translate) {
    const every = translate('form.everyPrefix');
    const localizedWeekly = translate('frequency.weekly');
    if (every === '每') {
      const units = localizedWeekly === '週'
        ? { daily: '天', weekly: '週', monthly: '個月', quarterly: '個季度', semiannual: '半年', annual: '年' }
        : FREQUENCY_INTERVAL_UNITS;
      return `${every} ${safeInterval} ${units[frequency as keyof typeof units]}一次`;
    }
    const unit = translate(`frequency.${frequency}`);
    return `${every} ${safeInterval} ${translate('form.intervalSuffix', { unit })}`;
  }
  return `每 ${safeInterval} ${FREQUENCY_INTERVAL_UNITS[frequency]}一次`;
}

/** 可选周期频率（排除一次性） */
export const RECURRING_FREQUENCIES: Frequency[] = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
];

export interface RecurrenceInput {
  accountId: string;
  frequency: Frequency;
  interval: number;
  baseAmount: Money;
  startDate: string;
  end: RecurrenceEnd;
  categoryId?: string;
  note?: string;
}

export interface RecurrenceResult {
  series: Series;
  transactions: Transaction[];
}

export interface RecurrenceExtensionResult {
  dates: string[];
  end: RecurrenceEnd;
}

/** 计算一次周期录入将生成的所有日期（真实记录的日期） */
export function recurrenceDates(input: RecurrenceInput): string[] {
  const { frequency, interval, startDate, end } = input;
  if (frequency === 'once') return [startDate];

  const dates: string[] = [];
  const safeInterval = Math.max(1, Math.floor(interval));
  for (let k = 0; k < MAX_OCCURRENCES; k++) {
    if (end.kind === 'count' && k >= end.count) break;
    const date = stepDate(startDate, frequency, safeInterval, k);
    if (end.kind === 'until' && !isSameOrBeforeDate(date, end.date)) break;
    dates.push(date);
  }
  return dates;
}

/** 将一次周期录入展开为 Series 元数据 + 一笔笔真实 Transaction */
export function expandRecurrence(input: RecurrenceInput): RecurrenceResult {
  const now = Date.now();
  const dates = recurrenceDates(input);
  const series: Series = {
    id: uid(),
    accountId: input.accountId,
    frequency: input.frequency,
    interval: Math.max(1, Math.floor(input.interval)),
    baseAmount: input.baseAmount,
    startDate: input.startDate,
    end: input.end,
    categoryId: input.categoryId,
    note: input.note,
    generatedThroughIndex: Math.max(-1, dates.length - 1),
    createdAt: now,
  };

  const transactions: Transaction[] = dates.map((date, occurrenceIndex) => ({
    id: uid(),
    accountId: input.accountId,
    date,
    amount: input.baseAmount,
    categoryId: input.categoryId,
    note: input.note,
    seriesId: series.id,
    scheduledDate: date,
    occurrenceIndex,
    overrideFields: [],
    createdAt: now,
    updatedAt: now,
  }));

  return { series, transactions };
}

/**
 * 在既有周期组后继续生成 count 期。
 *
 * 续期只依据周期元数据的生成序号，不使用被用户手工改过的日期。
 * 这样改单笔日期不会让后续周期跳过中间期次，也不会回填已删除的旧期次。
 */
export function extendRecurrence(
  series: Series,
  _latestTransactionDate: string | undefined,
  count: number,
): RecurrenceExtensionResult {
  if (series.frequency === 'once') return { dates: [], end: series.end };

  const safeCount = Math.min(
    MAX_OCCURRENCES,
    Math.max(1, Math.floor(Number.isFinite(count) ? count : 1)),
  );
  const safeInterval = Math.max(1, Math.floor(series.interval));

  // 新数据使用 generatedThroughIndex 作为唯一的序列边界。不能根据
  // 被用户改单笔日期后的最后一条记录推断下一期，否则会跳过或重复期次。
  let nextIndex: number;
  if (series.generatedThroughIndex != null) {
    nextIndex = Math.max(0, Math.floor(series.generatedThroughIndex) + 1);
  } else if (series.end.kind === 'count') {
    nextIndex = Math.max(1, Math.floor(series.end.count));
  } else {
    const generated = recurrenceDates({
      accountId: series.accountId,
      frequency: series.frequency,
      interval: series.interval,
      baseAmount: series.baseAmount,
      startDate: series.startDate,
      end: series.end,
      categoryId: series.categoryId,
      note: series.note,
    });
    nextIndex = generated.length;
  }

  const dates = Array.from({ length: safeCount }, (_, offset) =>
    stepDate(series.startDate, series.frequency, safeInterval, nextIndex + offset),
  );
  const last = dates[dates.length - 1];
  const end: RecurrenceEnd =
    series.end.kind === 'count'
      ? { kind: 'count', count: nextIndex + dates.length }
      : { kind: 'until', date: last };

  return { dates, end };
}
