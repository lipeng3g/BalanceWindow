import type { Frequency, Money, RecurrenceEnd } from './common';

/** 周期组：仅保存生成参数元数据，真实数据在 Transaction 中 */
export interface Series {
  id: string;
  accountId: string;
  frequency: Frequency;
  /** 每隔几个周期，默认 1 */
  interval: number;
  /** 生成时的基准金额（有符号，分） */
  baseAmount: Money;
  startDate: string;
  end: RecurrenceEnd;
  categoryId?: string;
  note?: string;
  /** 已生成到的 0-based 周期序号，避免手工改日期后续期错位。 */
  generatedThroughIndex?: number;
  createdAt: number;
}
