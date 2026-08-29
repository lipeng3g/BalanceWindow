import dayjs from 'dayjs';
import type { Granularity, Money } from '@/types';
import type { BalancePoint } from './balance';

export interface AggregatedPoint {
  /** 该区间末日期 YYYY-MM-DD */
  date: string;
  /** 展示标签，如 2026-06 / 2026-06-30 */
  label: string;
  /** 区间末余额快照 */
  value: Money;
}

/**
 * 按粒度聚合逐日余额。
 * 余额是时点快照，聚合取「区间末值」而非求和/平均。
 */
export function aggregate(
  daily: BalancePoint[],
  granularity: Granularity,
): AggregatedPoint[] {
  if (granularity === 'day') {
    return daily.map((p) => ({ date: p.date, label: p.date, value: p.value }));
  }

  const unit = granularity === 'week' ? 'week' : 'month';
  const buckets = new Map<string, BalancePoint>();
  for (const point of daily) {
    const key = dayjs(point.date).endOf(unit).format('YYYY-MM-DD');
    buckets.set(key, point); // 同区间内后写入者覆盖，最终保留最后一天
  }

  return Array.from(buckets.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([, point]) => ({
      date: point.date,
      label:
        granularity === 'month'
          ? dayjs(point.date).format('YYYY-MM')
          : point.date,
      value: point.value,
    }));
}
