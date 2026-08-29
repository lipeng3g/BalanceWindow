import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '@/store/useStore';
import { ACCOUNT_LIMIT_ERROR } from '@/store/slices/accountsSlice';
import { DATA_LIMITS } from '@/config/dataLimits';

const store = () => useStore.getState();

beforeEach(() => {
  store().resetAll();
});

describe('accounts slice', () => {
  it('示例数据遵守免费版两账户上限并保留投资流水', () => {
    store().loadSeed();
    expect(store().accounts).toHaveLength(2);
    expect(store().transactions.some((transaction) => (
      transaction.note === '季度定投'
      && transaction.accountId === store().accounts.find((account) => account.name === '储蓄账户')?.id
    ))).toBe(true);
  });

  it('新增账户并自动分配字段', () => {
    const id = store().addAccount({ name: '现金', openingBalance: 200000, openingDate: '2026-06-01' });
    const account = store().accounts.find((a) => a.id === id);
    expect(account?.name).toBe('现金');
    expect(account?.archived).toBe(false);
    expect(account?.color).toBeTruthy();
  });

  it('直接调用 Store 也不能绕过名称、备注和金额限制', () => {
    expect(() => store().addAccount({
      name: 'a'.repeat(DATA_LIMITS.accountNameInput + 1),
      openingBalance: 0,
      openingDate: '2026-06-01',
    })).toThrow('INVALID_NAME');

    expect(() => store().addTransaction({
      accountId: 'a1',
      date: '2026-06-10',
      amount: 100,
      note: 'n'.repeat(DATA_LIMITS.noteInput + 1),
    })).toThrow('INVALID_NOTE');
    expect(() => store().addTransaction({
      accountId: 'a1',
      date: '2026-06-10',
      amount: Number.MAX_SAFE_INTEGER + 1,
    })).toThrow('INVALID_AMOUNT');
  });

  it('更新与归档账户', () => {
    const id = store().addAccount({ name: '现金', openingBalance: 0, openingDate: '2026-06-01' });
    store().updateAccount(id, { name: '招行' });
    store().archiveAccount(id, true);
    const account = store().accounts.find((a) => a.id === id);
    expect(account?.name).toBe('招行');
    expect(account?.archived).toBe(true);
  });

  it('免费版创建第三个账户时拒绝，归档账户仍计入上限', () => {
    store().addAccount({ name: '工资卡', openingBalance: 0, openingDate: '2026-06-01' });
    const second = store().addAccount({ name: '现金', openingBalance: 0, openingDate: '2026-06-01' });
    store().archiveAccount(second, true);

    expect(() => store().addAccount({ name: '理财', openingBalance: 0, openingDate: '2026-06-01' }))
      .toThrow(ACCOUNT_LIMIT_ERROR);
  });

  it('删除账户同时清除其变动与系列', () => {
    const id = store().addAccount({ name: '现金', openingBalance: 0, openingDate: '2026-06-01' });
    store().addTransaction({ accountId: id, date: '2026-06-10', amount: 100 });
    store().addRecurring({
      accountId: id,
      frequency: 'monthly',
      interval: 1,
      baseAmount: 100,
      startDate: '2026-06-10',
      end: { kind: 'count', count: 3 },
    });
    store().removeAccount(id);
    expect(store().accounts).toHaveLength(0);
    expect(store().transactions).toHaveLength(0);
    expect(store().series).toHaveLength(0);
  });
});

describe('transactions slice', () => {
  it('addRecurring 生成系列与对应数量记录', () => {
    const id = store().addRecurring({
      accountId: 'a1',
      frequency: 'monthly',
      interval: 1,
      baseAmount: 100,
      startDate: '2026-06-10',
      end: { kind: 'count', count: 3 },
    });
    expect(store().series).toHaveLength(1);
    expect(store().series[0].id).toBe(id);
    expect(store().transactions).toHaveLength(3);
  });

  it('extendRecurring 在原周期组后追加记录且不创建新组', () => {
    const id = store().addRecurring({
      accountId: 'a1',
      frequency: 'monthly',
      interval: 1,
      baseAmount: 100,
      startDate: '2026-01-31',
      end: { kind: 'count', count: 2 },
      note: '工资',
    });
    const result = store().extendRecurring(id, 2);
    expect(result).toMatchObject({ added: 2, first: '2026-03-31', last: '2026-04-30' });
    expect(store().series).toHaveLength(1);
    expect(store().transactions.map((t) => t.date)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
    expect(store().transactions.every((t) => t.seriesId === id)).toBe(true);
    expect(store().series[0].end).toEqual({ kind: 'count', count: 4 });

    const second = store().extendRecurring(id, 2);
    expect(second).toMatchObject({ added: 2, first: '2026-05-31', last: '2026-06-30' });
    expect(new Set(store().transactions.map((t) => `${t.seriesId}:${t.date}`)).size).toBe(6);
    expect(store().series[0].end).toEqual({ kind: 'count', count: 6 });
  });

  it('extendRecurring 仅对新增批次应用新参数并更新周期元数据', () => {
    const id = store().addRecurring({
      accountId: 'a1',
      frequency: 'monthly',
      interval: 1,
      baseAmount: 100,
      startDate: '2026-01-10',
      end: { kind: 'count', count: 2 },
      categoryId: 'old-category',
      note: '旧工资',
    });

    store().extendRecurring(id, 2, {
      baseAmount: 200,
      categoryId: 'new-category',
      note: '新工资',
    });

    expect(store().transactions.slice(0, 2).map((t) => [t.amount, t.categoryId, t.note])).toEqual([
      [100, 'old-category', '旧工资'],
      [100, 'old-category', '旧工资'],
    ]);
    expect(store().transactions.slice(2).map((t) => [t.amount, t.categoryId, t.note])).toEqual([
      [200, 'new-category', '新工资'],
      [200, 'new-category', '新工资'],
    ]);
    expect(store().series[0]).toMatchObject({
      baseAmount: 200,
      categoryId: 'new-category',
      note: '新工资',
      end: { kind: 'count', count: 4 },
    });
  });

  it('批量修改与批量删除', () => {
    store().addRecurring({
      accountId: 'a1',
      frequency: 'monthly',
      interval: 1,
      baseAmount: 100,
      startDate: '2026-06-10',
      end: { kind: 'count', count: 3 },
    });
    const ids = store().transactions.map((t) => t.id);
    store().batchUpdateTransactions(ids.slice(0, 2), { amount: 999 });
    expect(store().transactions.filter((t) => t.amount === 999)).toHaveLength(2);
    store().batchDeleteTransactions(ids.slice(0, 2));
    expect(store().transactions).toHaveLength(1);
  });

  it('编辑周期流水时不允许破坏周期组账户关系', () => {
    const first = store().addAccount({ name: '工资卡', openingBalance: 0, openingDate: '2026-01-01' });
    const second = store().addAccount({ name: '现金', openingBalance: 0, openingDate: '2026-01-01' });
    const seriesId = store().addRecurring({
      accountId: first,
      frequency: 'monthly',
      interval: 1,
      baseAmount: 100,
      startDate: '2026-01-10',
      end: { kind: 'count', count: 1 },
    });
    const transaction = store().transactions[0];

    store().updateTransaction(transaction.id, { accountId: second, amount: 200 });

    expect(store().transactions[0]).toMatchObject({ accountId: first, amount: 200, seriesId });
  });

  it('单笔周期编辑记录例外字段', () => {
    store().addRecurring({
      accountId: 'a1',
      frequency: 'monthly',
      interval: 1,
      baseAmount: 100,
      startDate: '2026-06-10',
      end: { kind: 'count', count: 2 },
    });
    const transaction = store().transactions[0];

    store().updateTransaction(transaction.id, { amount: 450, note: '本月修正' });

    expect(store().transactions[0]).toMatchObject({
      amount: 450,
      note: '本月修正',
      overrideFields: ['amount', 'note'],
    });
  });

  it('从本期开始修改时覆盖当前笔、保留后续手工例外', () => {
    store().addRecurring({
      accountId: 'a1',
      frequency: 'monthly',
      interval: 1,
      baseAmount: 100,
      startDate: '2026-06-10',
      end: { kind: 'count', count: 4 },
    });
    const transactions = store().transactions;
    store().updateTransaction(transactions[1].id, { amount: 450 });
    store().updateTransaction(transactions[2].id, { amount: 475 });

    const result = store().updateRecurringFrom(transactions[1].id, { amount: 500 });

    expect(result).toEqual({ updated: 2, preserved: 1 });
    expect(store().transactions.map((t) => t.amount)).toEqual([100, 500, 475, 500]);
    expect(store().transactions[1].overrideFields).toEqual([]);
    expect(store().transactions[2].overrideFields).toEqual(['amount']);
    expect(store().series[0].baseAmount).toBe(500);
  });

  it('从本期开始可显式覆盖后续手工例外', () => {
    store().addRecurring({
      accountId: 'a1',
      frequency: 'monthly',
      interval: 1,
      baseAmount: 100,
      startDate: '2026-06-10',
      end: { kind: 'count', count: 3 },
    });
    const transactions = store().transactions;
    store().updateTransaction(transactions[1].id, { amount: 450 });

    const result = store().updateRecurringFrom(
      transactions[0].id,
      { amount: 500 },
      { overwriteOverrides: true },
    );

    expect(result).toEqual({ updated: 3, preserved: 0 });
    expect(store().transactions.map((t) => t.amount)).toEqual([500, 500, 500]);
    expect(store().transactions.every((t) => !t.overrideFields?.includes('amount'))).toBe(true);
  });

  it('周期续期按序号追加，即使手工日期与下一期日期相同也不跳期', () => {
    const seriesId = store().addRecurring({
      accountId: 'a1',
      frequency: 'monthly',
      interval: 1,
      baseAmount: 100,
      startDate: '2026-01-10',
      end: { kind: 'count', count: 2 },
    });
    const second = store().transactions[1];
    store().updateTransaction(second.id, { date: '2026-03-10' });

    const firstExtension = store().extendRecurring(seriesId, 2);
    expect(firstExtension).toMatchObject({ added: 2, first: '2026-03-10', last: '2026-04-10' });
    expect(store().transactions.filter((t) => t.seriesId === seriesId).map((t) => t.occurrenceIndex))
      .toEqual([0, 1, 2, 3]);

    const secondExtension = store().extendRecurring(seriesId, 1);
    expect(secondExtension).toMatchObject({ added: 1, first: '2026-05-10', last: '2026-05-10' });
    expect(store().series[0].generatedThroughIndex).toBe(4);
  });

  it('删空一组周期记录后自动清理 series', () => {
    store().addRecurring({
      accountId: 'a1',
      frequency: 'monthly',
      interval: 1,
      baseAmount: 100,
      startDate: '2026-06-10',
      end: { kind: 'count', count: 3 },
    });
    const ids = store().transactions.map((t) => t.id);
    store().batchDeleteTransactions(ids.slice(0, 2));
    expect(store().series).toHaveLength(1);
    store().removeTransaction(ids[2]);
    expect(store().transactions).toHaveLength(0);
    expect(store().series).toHaveLength(0);
  });
});

describe('categories slice', () => {
  it('删除分类时清除引用', () => {
    const cid = store().addCategory({ name: '工资' });
    const aid = store().addAccount({
      name: '现金',
      openingBalance: 0,
      openingDate: '2026-06-01',
      categoryId: cid,
    });
    store().addTransaction({ accountId: aid, date: '2026-06-10', amount: 100, categoryId: cid });
    store().removeCategory(cid);
    expect(store().categories).toHaveLength(0);
    expect(store().accounts[0].categoryId).toBeUndefined();
    expect(store().transactions[0].categoryId).toBeUndefined();
  });
});

describe('settings slice', () => {
  it('主题、粒度与显隐切换', () => {
    store().setTheme('dark');
    store().setGranularity('week');
    store().toggleTotal();
    store().setVisibleAccountIds(['a1']);
    expect(store().theme).toBe('dark');
    expect(store().granularity).toBe('week');
    expect(store().showTotal).toBe(false);
    expect(store().visibleAccountIds).toEqual(['a1']);
    expect(store().rangePreset).toBe('P3M-F12M');
  });
});

describe('data import/export', () => {
  it('导出再导入数据一致', () => {
    store().addAccount({ name: '现金', openingBalance: 200000, openingDate: '2026-06-01' });
    const exported = store().exportData();
    store().resetAll();
    store().importData(exported);
    expect(store().accounts).toHaveLength(1);
    expect(store().exportData()).toEqual(exported);
  });
});
