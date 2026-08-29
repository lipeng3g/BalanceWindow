/** 金额：以当前币种最小货币单位保存的整数，避免浮点误差。 */
export type Money = number;

/** 数据空间的基础币种；当前版本所有账户共享同一币种，不做汇率换算。 */
export type CurrencyCode = string;

/** 周期频率 */
export type Frequency =
  | 'once'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual';

/** 周期结束条件：按次数 或 按截止日期（含当日） */
export type RecurrenceEnd =
  | { kind: 'count'; count: number }
  | { kind: 'until'; date: string };

export type Theme = 'light' | 'dark';

export type Granularity = 'day' | 'week' | 'month';
