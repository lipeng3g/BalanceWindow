import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { aggregate } from '@/utils/aggregate';
import {
  dailyBalancesSorted,
  groupTxsByAccount,
  totalDailyBalancesFromDaily,
  type BalancePoint,
} from '@/utils/balance';
import { addMonths, today } from '@/utils/date';
import { minorToMajor } from '@/utils/money';

export interface ChartSeries {
  name: string;
  color: string;
}

export interface ChartValue {
  time: string;
  date: string;
  value: number;
  type: string;
  phase: 'history' | 'forecast';
}

export interface ChartDataResult {
  values: ChartValue[];
  series: ChartSeries[];
  /** 聚合标签 → 该区间末真实日期，用于点击图表定位当日明细 */
  labelToDate: Record<string, string>;
  from: string;
  to: string;
  todayLabel?: string;
}

export const TOTAL_NAME = '总资产';
const TOTAL_COLOR = '#64748b';

/**
 * 解析时间范围。preset 为 'custom' 且提供了 customFrom/customTo 时使用自定义范围，
 * 否则按 'P1M-F12M'（过去 1 月 ~ 未来 12 月）格式解析。
 */
export function parseRange(
  preset: string,
  customFrom?: string,
  customTo?: string,
): { from: string; to: string } {
  if (preset === 'custom' && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }
  const matched = /P(\d+)M-F(\d+)M/.exec(preset);
  const past = matched ? Number(matched[1]) : 1;
  const future = matched ? Number(matched[2]) : 12;
  const base = today();
  return { from: addMonths(base, -past), to: addMonths(base, future) };
}

/** 由 store 派生图表所需的多系列折线数据（总资产线 + 各账户线）。
 *  传入 focusedAccountId 时仅展示该账户，忽略可见账户白名单与总资产线。 */
export function useChartData(focusedAccountId?: string | null): ChartDataResult {
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const granularity = useStore((s) => s.granularity);
  const rangePreset = useStore((s) => s.rangePreset);
  const customFrom = useStore((s) => s.customFrom);
  const customTo = useStore((s) => s.customTo);
  const visibleAccountIds = useStore((s) => s.visibleAccountIds);
  const showTotal = useStore((s) => s.showTotal);
  const currencyCode = useStore((s) => s.currencyCode);

  return useMemo(() => {
    const { from, to } = parseRange(rangePreset, customFrom, customTo);
    const currentDate = today();
    const activeAccounts = accounts.filter((a) => !a.archived);
    const focused = focusedAccountId
      ? activeAccounts.find((a) => a.id === focusedAccountId) ?? null
      : null;
    const shown = focused
      ? [focused]
      : visibleAccountIds.length
        ? activeAccounts.filter((a) => visibleAccountIds.includes(a.id))
        : activeAccounts;
    // A stale/partially imported visibleAccountIds list must not turn the
    // analysis into an empty set. The UI treats an empty selection as all
    // active accounts, so the derived data follows the same rule.
    const analyzedAccounts = shown.length ? shown : activeAccounts;

    // 每个活跃账户的逐日余额只算一次：总资产线与账户线共用同一份结果
    const byAccount = groupTxsByAccount(transactions);
    const dailyByAccount = new Map<string, BalancePoint[]>(
      activeAccounts.map((a) => [
        a.id,
        dailyBalancesSorted(a, byAccount.get(a.id) ?? [], from, to),
      ]),
    );

    const values: ChartValue[] = [];
    const series: ChartSeries[] = [];
    const labelToDate: Record<string, string> = {};

    if (!focused && showTotal && analyzedAccounts.length) {
      series.push({ name: TOTAL_NAME, color: TOTAL_COLOR });
      const totalDaily = totalDailyBalancesFromDaily(
        analyzedAccounts.map((a) => dailyByAccount.get(a.id) ?? []),
        from,
        to,
      );
      for (const point of aggregate(totalDaily, granularity)) {
        values.push({
          time: point.label,
          date: point.date,
          value: minorToMajor(point.value, currencyCode),
          type: TOTAL_NAME,
          phase: point.date > currentDate ? 'forecast' : 'history',
        });
        labelToDate[point.label] = point.date;
      }
    }

    for (const account of analyzedAccounts) {
      series.push({ name: account.name, color: account.color });
      const daily = dailyByAccount.get(account.id) ?? [];
      for (const point of aggregate(daily, granularity)) {
        values.push({
          time: point.label,
          date: point.date,
          value: minorToMajor(point.value, currencyCode),
          type: account.name,
          phase: point.date > currentDate ? 'forecast' : 'history',
        });
        labelToDate[point.label] = point.date;
      }
    }

    const todayLabel = Object.entries(labelToDate)
      .sort((a, b) => (a[1] < b[1] ? -1 : 1))
      .find(([, date]) => date >= currentDate)?.[0];

    return { values, series, labelToDate, from, to, todayLabel };
  }, [accounts, transactions, granularity, rangePreset, customFrom, customTo, visibleAccountIds, showTotal, focusedAccountId, currencyCode]);
}
