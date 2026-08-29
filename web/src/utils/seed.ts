import type { Account, Category, RecurrenceEnd, Series, Transaction } from '@/types';
import { addMonths, today } from './date';
import { uid } from './id';
import { yuanToCents } from './money';
import { PALETTE } from './palette';
import { expandRecurrence } from './recurrence';

export interface SeedData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  series: Series[];
}

/** 常用分类预置，供首屏示例与「载入常用分类」复用 */
export const DEFAULT_CATEGORY_SEEDS: ReadonlyArray<{ name: string; color: string }> = [
  { name: '工资', color: PALETTE[1] },
  { name: '餐饮', color: PALETTE[2] },
  { name: '房贷', color: PALETTE[3] },
  { name: '房租', color: PALETTE[8] },
  { name: '投资', color: PALETTE[4] },
  { name: '理财', color: PALETTE[5] },
  { name: '购物', color: PALETTE[6] },
  { name: '交通', color: PALETTE[7] },
];

/**
 * 生成首次进入时的示例数据：含分类、账户与过去一年至未来两年的周期性收支，
 * 让首屏即有可读的资金走势，用户可随时通过「清空」按钮重置为空白。
 */
export function createSeedData(): SeedData {
  const now = Date.now();
  const base = today();
  const startDate = addMonths(base, -12);
  const end: RecurrenceEnd = { kind: 'until', date: addMonths(base, 24) };

  const categories: Category[] = DEFAULT_CATEGORY_SEEDS.map((c) => ({
    id: uid(),
    name: c.name,
    color: c.color,
    createdAt: now,
  }));
  const catId = (name: string) => categories.find((c) => c.name === name)?.id;

  const makeAccount = (name: string, balanceYuan: number, color: string): Account => ({
    id: uid(),
    name,
    openingBalance: yuanToCents(balanceYuan),
    openingDate: startDate,
    color,
    archived: false,
    createdAt: now,
    updatedAt: now,
  });
  const salaryCard = makeAccount('工资卡', 30000, PALETTE[0]);
  const savings = makeAccount('储蓄账户', 150000, PALETTE[5]);
  // 免费版最多两个账户；投资示例并入储蓄账户，避免示例数据一载入就超过上限。
  const accounts: Account[] = [salaryCard, savings];

  const recurrences = [
    { accountId: salaryCard.id, amountYuan: 18000, category: '工资', note: '月薪', frequency: 'monthly' as const },
    { accountId: salaryCard.id, amountYuan: -8000, category: '房贷', note: '房贷还款', frequency: 'monthly' as const },
    { accountId: salaryCard.id, amountYuan: -3500, category: '餐饮', note: '日常餐饮', frequency: 'monthly' as const },
    { accountId: salaryCard.id, amountYuan: -1500, category: '交通', note: '通勤交通', frequency: 'monthly' as const },
    { accountId: savings.id, amountYuan: 6000, category: '理财', note: '每月储蓄', frequency: 'monthly' as const },
    { accountId: savings.id, amountYuan: 12000, category: '投资', note: '季度定投', frequency: 'quarterly' as const },
  ];

  const series: Series[] = [];
  const transactions: Transaction[] = [];
  for (const r of recurrences) {
    const result = expandRecurrence({
      accountId: r.accountId,
      frequency: r.frequency,
      interval: 1,
      baseAmount: yuanToCents(r.amountYuan),
      startDate,
      end,
      categoryId: catId(r.category),
      note: r.note,
    });
    series.push(result.series);
    transactions.push(...result.transactions);
  }

  return { accounts, categories, transactions, series };
}
