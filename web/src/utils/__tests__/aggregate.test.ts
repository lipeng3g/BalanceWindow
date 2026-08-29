import { describe, expect, it } from 'vitest';
import type { BalancePoint } from '@/utils/balance';
import { aggregate } from '@/utils/aggregate';

const daily: BalancePoint[] = [
  { date: '2026-06-29', value: 100 },
  { date: '2026-06-30', value: 200 },
  { date: '2026-07-01', value: 300 },
];

describe('aggregate', () => {
  it('day 粒度逐日返回', () => {
    expect(aggregate(daily, 'day')).toEqual([
      { date: '2026-06-29', label: '2026-06-29', value: 100 },
      { date: '2026-06-30', label: '2026-06-30', value: 200 },
      { date: '2026-07-01', label: '2026-07-01', value: 300 },
    ]);
  });

  it('month 粒度取月末快照值', () => {
    expect(aggregate(daily, 'month')).toEqual([
      { date: '2026-06-30', label: '2026-06', value: 200 },
      { date: '2026-07-01', label: '2026-07', value: 300 },
    ]);
  });

  it('week 粒度取周末快照值（同周覆盖为末值）', () => {
    const points: BalancePoint[] = [
      { date: '2026-06-05', value: 100 },
      { date: '2026-06-06', value: 200 },
      { date: '2026-06-07', value: 300 },
    ];
    const result = aggregate(points, 'week');
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(200);
    expect(result[1].value).toBe(300);
  });

  it('空数据返回空', () => {
    expect(aggregate([], 'month')).toEqual([]);
  });
});
