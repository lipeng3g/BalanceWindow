import type { Account, Money, Transaction } from '@/types';
import { eachDay, isBeforeDate, isSameOrBeforeDate } from './date';

export interface BalancePoint {
  date: string;
  value: Money;
}

/** 将交易按账户分组并按日期升序排序（一次遍历，供多次余额计算复用） */
export function groupTxsByAccount(txs: Transaction[]): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>();
  for (const t of txs) {
    const list = map.get(t.accountId);
    if (list) list.push(t);
    else map.set(t.accountId, [t]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  return map;
}

/**
 * 计算单账户在 [from, to] 区间内的逐日余额。
 * accountTxs 必须为该账户的交易且已按日期升序排序（见 groupTxsByAccount）。
 * 账户起始日之前不输出数据点（视为账户尚未存在，避免图表伪造 0 余额线）。
 */
export function dailyBalancesSorted(
  account: Account,
  accountTxs: Transaction[],
  from: string,
  to: string,
): BalancePoint[] {
  // 区间起点之前的累计（含初始余额）
  let running = account.openingBalance;
  let idx = 0;
  while (idx < accountTxs.length && isBeforeDate(accountTxs[idx].date, from)) {
    running += accountTxs[idx].amount;
    idx++;
  }

  const points: BalancePoint[] = [];
  for (const day of eachDay(from, to)) {
    while (idx < accountTxs.length && isSameOrBeforeDate(accountTxs[idx].date, day)) {
      running += accountTxs[idx].amount;
      idx++;
    }
    if (isSameOrBeforeDate(account.openingDate, day)) {
      points.push({ date: day, value: running });
    }
  }
  return points;
}

/**
 * 计算单账户在 [from, to] 区间内的逐日余额。
 * 账户起始日之前不计入（视为账户尚未存在）。
 */
export function dailyBalances(
  account: Account,
  txs: Transaction[],
  from: string,
  to: string,
): BalancePoint[] {
  const accountTxs = txs
    .filter((t) => t.accountId === account.id)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return dailyBalancesSorted(account, accountTxs, from, to);
}

/** 计算所有账户的逐日总资产（账户起始日之前不参与汇总） */
export function totalDailyBalances(
  accounts: Account[],
  txs: Transaction[],
  from: string,
  to: string,
): BalancePoint[] {
  const byAccount = groupTxsByAccount(txs);
  return totalDailyBalancesFromDaily(
    accounts.map((a) => dailyBalancesSorted(a, byAccount.get(a.id) ?? [], from, to)),
    from,
    to,
  );
}

/** 由已算好的各账户逐日余额合成总资产逐日余额（避免重复计算） */
export function totalDailyBalancesFromDaily(
  perAccount: BalancePoint[][],
  from: string,
  to: string,
): BalancePoint[] {
  const days = eachDay(from, to);
  const totals = new Map<string, Money>();

  for (const points of perAccount) {
    for (const point of points) {
      totals.set(point.date, (totals.get(point.date) ?? 0) + point.value);
    }
  }
  return days
    .filter((date) => totals.has(date))
    .map((date) => ({ date, value: totals.get(date) ?? 0 }));
}

/** 账户在指定日期的余额（用于卡片展示） */
export function balanceAt(account: Account, txs: Transaction[], date: string): Money {
  if (isBeforeDate(date, account.openingDate)) return 0;
  let sum = account.openingBalance;
  for (const t of txs) {
    if (t.accountId === account.id && isSameOrBeforeDate(t.date, date)) {
      sum += t.amount;
    }
  }
  return sum;
}

/** 批量计算多个账户在同一日期的余额（一次分组遍历） */
export function balancesAt(
  accounts: Account[],
  txs: Transaction[],
  date: string,
): Map<string, Money> {
  const byAccount = groupTxsByAccount(txs);
  const result = new Map<string, Money>();
  for (const account of accounts) {
    if (isBeforeDate(date, account.openingDate)) {
      result.set(account.id, 0);
      continue;
    }
    let sum = account.openingBalance;
    for (const t of byAccount.get(account.id) ?? []) {
      if (isSameOrBeforeDate(t.date, date)) sum += t.amount;
      else break; // 已按日期升序，之后的交易无需再看
    }
    result.set(account.id, sum);
  }
  return result;
}
