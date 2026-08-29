import { describe, expect, it } from 'vitest';
import type { Account, Transaction } from '@/types';
import { balanceAt, dailyBalances, totalDailyBalances } from '@/utils/balance';

const makeAccount = (over: Partial<Account> = {}): Account => ({
  id: 'a1',
  name: '现金',
  openingBalance: 200000,
  openingDate: '2026-06-01',
  color: '#000',
  archived: false,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const makeTx = (over: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(),
  accountId: 'a1',
  date: '2026-06-10',
  amount: 0,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

describe('balanceAt', () => {
  const account = makeAccount();
  const txs = [
    makeTx({ date: '2026-06-10', amount: 150000 }),
    makeTx({ date: '2026-06-20', amount: -50000 }),
  ];

  it('累加起始余额与历史变动', () => {
    expect(balanceAt(account, txs, '2026-06-05')).toBe(200000);
    expect(balanceAt(account, txs, '2026-06-10')).toBe(350000);
    expect(balanceAt(account, txs, '2026-06-25')).toBe(300000);
  });

  it('起始日之前视为账户不存在（0）', () => {
    expect(balanceAt(account, txs, '2026-05-31')).toBe(0);
  });

  it('空交易返回初始余额', () => {
    expect(balanceAt(account, [], '2026-06-30')).toBe(200000);
  });

  it('支持负余额', () => {
    const zero = makeAccount({ openingBalance: 0 });
    expect(balanceAt(zero, [makeTx({ date: '2026-06-02', amount: -10000 })], '2026-06-30')).toBe(
      -10000,
    );
  });
});

describe('dailyBalances', () => {
  it('逐日推进并在变动日累加', () => {
    const account = makeAccount();
    const txs = [makeTx({ date: '2026-06-10', amount: 150000 })];
    expect(dailyBalances(account, txs, '2026-06-09', '2026-06-11')).toEqual([
      { date: '2026-06-09', value: 200000 },
      { date: '2026-06-10', value: 350000 },
      { date: '2026-06-11', value: 350000 },
    ]);
  });

  it('起始日之前不输出伪 0 数据点', () => {
    const account = makeAccount();
    expect(dailyBalances(account, [], '2026-05-30', '2026-06-01')).toEqual([
      { date: '2026-06-01', value: 200000 },
    ]);
  });
});

describe('totalDailyBalances', () => {
  it('多账户按日相加', () => {
    const a1 = makeAccount({ id: 'a1', openingBalance: 100000 });
    const a2 = makeAccount({ id: 'a2', openingBalance: 300000 });
    const txs = [makeTx({ accountId: 'a2', date: '2026-06-01', amount: 50000 })];
    expect(totalDailyBalances([a1, a2], txs, '2026-06-01', '2026-06-01')).toEqual([
      { date: '2026-06-01', value: 450000 },
    ]);
  });

  it('总资产在所有账户起始日前不输出数据点', () => {
    const account = makeAccount({ openingDate: '2026-06-03' });
    expect(totalDailyBalances([account], [], '2026-06-01', '2026-06-03')).toEqual([
      { date: '2026-06-03', value: 200000 },
    ]);
  });
});
