import type { AppSettings, Granularity, Theme } from '@/types';
import type { SliceCreator } from '../types';

export const initialSettings: AppSettings = {
  currencyCode: 'CNY',
  theme: 'light',
  chartRangeVersion: 1,
  rangePreset: 'P3M-F12M',
  granularity: 'day',
  visibleAccountIds: [],
  showTotal: true,
  showChartLabels: false,
};

export interface SettingsSlice extends AppSettings {
  setCurrencyCode: (currencyCode: string) => void;
  setTheme: (theme: Theme) => void;
  setRangePreset: (preset: string) => void;
  /** 设置自定义起止范围，并将预设切换为 'custom' */
  setCustomRange: (from: string, to: string) => void;
  setGranularity: (granularity: Granularity) => void;
  /** 设置图表可见账户白名单；空数组表示全部显示 */
  setVisibleAccountIds: (ids: string[]) => void;
  toggleTotal: () => void;
  toggleChartLabels: () => void;
}

export const createSettingsSlice: SliceCreator<SettingsSlice> = (set) => ({
  ...initialSettings,

  setCurrencyCode: (currencyCode) => set({ currencyCode: currencyCode.toUpperCase() }),
  setTheme: (theme) => set({ theme }),
  setRangePreset: (rangePreset) => set({ rangePreset }),
  setCustomRange: (customFrom, customTo) =>
    set({ rangePreset: 'custom', customFrom, customTo }),
  setGranularity: (granularity) => set({ granularity }),
  setVisibleAccountIds: (visibleAccountIds) => set({ visibleAccountIds }),
  toggleTotal: () => set((s) => ({ showTotal: !s.showTotal })),
  toggleChartLabels: () => set((s) => ({ showChartLabels: !s.showChartLabels })),
});
