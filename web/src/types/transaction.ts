import type { Money } from './common';

export type TransactionOverrideField = 'date' | 'amount' | 'categoryId' | 'note';

export interface Transaction {
  id: string;
  accountId: string;
  /** 发生日期 YYYY-MM-DD */
  date: string;
  /** 有符号金额（分）：存入 > 0，取出 < 0 */
  amount: Money;
  categoryId?: string;
  note?: string;
  /** 属于某周期组则关联，一次性为空 */
  seriesId?: string;
  /** 周期原计划日期；单笔改期时保留，用于后续稳定续期。 */
  scheduledDate?: string;
  /** 周期中的 0-based 序号；旧数据缺失时按日期/结束条件兼容推断。 */
  occurrenceIndex?: number;
  /** 用户手工改过的字段，后续“从本期起”默认保留。 */
  overrideFields?: TransactionOverrideField[];
  createdAt: number;
  updatedAt: number;
}
