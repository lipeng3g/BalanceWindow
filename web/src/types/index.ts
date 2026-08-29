import type { Account } from './account';
import type { Category } from './category';
import type { CurrencyCode, Granularity, Theme } from './common';
import type { Series } from './series';
import type { Transaction } from './transaction';

export type { Account } from './account';
export type { Category } from './category';
export type { Series } from './series';
export type { Transaction, TransactionOverrideField } from './transaction';
export type {
  CurrencyCode,
  Frequency,
  Granularity,
  Money,
  RecurrenceEnd,
  Theme,
} from './common';

/** 当前数据 schema 版本 */
export const DATA_VERSION = 1;

/** 持久化的业务数据 */
export interface AppData {
  version: number;
  /** v1 数据缺少该字段时按 CNY 迁移；所有新导出都会写入。 */
  currencyCode?: CurrencyCode;
  accounts: Account[];
  transactions: Transaction[];
  series: Series[];
  categories: Category[];
}

/** 持久化的界面设置 */
export interface AppSettings {
  currencyCode: CurrencyCode;
  theme: Theme;
  /** 图表范围设置版本，用于一次性迁移旧版默认值 */
  chartRangeVersion: number;
  /** 时间范围预设，如 'P1M-F12M'（过去1月~未来12月）；'custom' 时使用 customFrom/customTo */
  rangePreset: string;
  /** 自定义范围起始日 YYYY-MM-DD（rangePreset 为 'custom' 时生效） */
  customFrom?: string;
  /** 自定义范围结束日 YYYY-MM-DD（rangePreset 为 'custom' 时生效） */
  customTo?: string;
  granularity: Granularity;
  /** 图表中显示的账户 id；空数组表示全部显示 */
  visibleAccountIds: string[];
  showTotal: boolean;
  /** 曲线上是否显示数据点金额标签，默认关闭 */
  showChartLabels: boolean;
}
