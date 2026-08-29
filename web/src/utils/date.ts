import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import type { Frequency } from '@/types';

dayjs.extend(isSameOrBefore);

export const DATE_FORMAT = 'YYYY-MM-DD';

export function today(): string {
  return dayjs().format(DATE_FORMAT);
}

export function formatDate(date: string | Date): string {
  return dayjs(date).format(DATE_FORMAT);
}

/**
 * 计算周期序列中第 k 笔（k 从 0 开始）的日期。
 * 月/季/半年/年步进时若目标月无对应日，dayjs 自动 clamp 到当月最后一天。
 */
export function stepDate(
  start: string,
  frequency: Frequency,
  interval: number,
  k: number,
): string {
  const base = dayjs(start);
  const step = interval * k;
  switch (frequency) {
    case 'once':
      return base.format(DATE_FORMAT);
    case 'daily':
      return base.add(step, 'day').format(DATE_FORMAT);
    case 'weekly':
      return base.add(step, 'week').format(DATE_FORMAT);
    case 'monthly':
      return base.add(step, 'month').format(DATE_FORMAT);
    case 'quarterly':
      return base.add(step * 3, 'month').format(DATE_FORMAT);
    case 'semiannual':
      return base.add(step * 6, 'month').format(DATE_FORMAT);
    case 'annual':
      return base.add(step, 'year').format(DATE_FORMAT);
  }
}

/** a <= b（按天比较） */
export function isSameOrBeforeDate(a: string, b: string): boolean {
  return dayjs(a).isSameOrBefore(dayjs(b), 'day');
}

/** a < b（按天比较） */
export function isBeforeDate(a: string, b: string): boolean {
  return dayjs(a).isBefore(dayjs(b), 'day');
}

/** 在 date 基础上增减月份 */
export function addMonths(date: string, months: number): string {
  return dayjs(date).add(months, 'month').format(DATE_FORMAT);
}

/** 逐日遍历 [from, to]（含端点） */
export function eachDay(from: string, to: string): string[] {
  const result: string[] = [];
  let cur = dayjs(from);
  const end = dayjs(to);
  while (cur.isSameOrBefore(end, 'day')) {
    result.push(cur.format(DATE_FORMAT));
    cur = cur.add(1, 'day');
  }
  return result;
}
