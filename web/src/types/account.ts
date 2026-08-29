import type { Money } from './common';

export interface Account {
  id: string;
  name: string;
  categoryId?: string;
  /** 初始余额（分） */
  openingBalance: Money;
  /** 起始日 YYYY-MM-DD，曲线起点 */
  openingDate: string;
  /** 图表中该账户线条颜色 */
  color: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}
