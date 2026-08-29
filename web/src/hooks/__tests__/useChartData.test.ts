import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseRange } from '@/hooks/useChartData';
import { useChartData } from '@/hooks/useChartData';
import { useStore } from '@/store/useStore';
import { addMonths, today } from '@/utils/date';

beforeEach(() => {
  useStore.getState().resetAll();
});

describe('parseRange', () => {
  it('支持默认的过去 3 月到今后 1 年范围', () => {
    expect(parseRange('P3M-F12M')).toEqual({
      from: addMonths(today(), -3),
      to: addMonths(today(), 12),
    });
  });

  it('自定义范围优先使用用户日期', () => {
    expect(parseRange('custom', '2026-01-01', '2027-01-01')).toEqual({
      from: '2026-01-01',
      to: '2027-01-01',
    });
  });

  it('选择单个账户时总资产线只汇总当前分析范围', () => {
    const first = useStore.getState().addAccount({
      name: '现金',
      openingBalance: 10_000,
      openingDate: today(),
    });
    useStore.getState().addAccount({
      name: '储蓄',
      openingBalance: 20_000,
      openingDate: today(),
    });
    useStore.getState().setVisibleAccountIds([first]);

    const { result } = renderHook(() => useChartData());
    const total = result.current.values.find((value) => value.type === '总资产');

    expect(total?.value).toBe(100);
    expect(result.current.series.map((item) => item.name)).toEqual(['总资产', '现金']);
  });
});
