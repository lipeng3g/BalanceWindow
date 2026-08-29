import { useMemo, type ReactNode } from 'react';
import {
  IconActivity,
  IconArrowDown,
  IconArrowUp,
  IconCoinMoneyStroked,
  IconHistogram,
} from '@douyinfe/semi-icons';
import { parseRange } from '@/hooks/useChartData';
import { useStore } from '@/store/useStore';
import { balancesAt } from '@/utils/balance';
import { today } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import { formatDisplayDate } from '@/utils/locale';
import { useI18n } from '@/i18n';

interface StatProps {
  label: string;
  value: string;
  hint?: string;
  tone?: 'up' | 'down';
  icon?: ReactNode;
}

function targetLabel(
  accountId: string | null | undefined,
  visibleIds: string[],
  accounts: { id: string; archived: boolean }[],
  t: (key: string) => string,
): string {
  const active = accounts.filter((account) => !account.archived);
  const hasSingleVisible = visibleIds.length === 1
    && active.some((account) => account.id === visibleIds[0]);
  return accountId || hasSingleVisible ? t('stats.currentBalance') : t('stats.totalAssets');
}

function Stat({ label, value, hint, tone, icon }: StatProps) {
  return (
    <div className="stat app-card">
      {icon && <div className="stat__icon">{icon}</div>}
      <div className="stat__body">
        <div className="stat__label">{label}</div>
        <div className={`stat__value mono-num${tone ? ` stat__value--${tone}` : ''}`}>
          {tone === 'up' && <IconArrowUp size="small" />}
          {tone === 'down' && <IconArrowDown size="small" />}
          {value}
        </div>
        {hint && <div className="stat__hint">{hint}</div>}
      </div>
    </div>
  );
}

export default function OverviewStats({ accountId }: { accountId?: string | null }) {
  const { t } = useI18n();
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const rangePreset = useStore((s) => s.rangePreset);
  const customFrom = useStore((s) => s.customFrom);
  const customTo = useStore((s) => s.customTo);
  const currencyCode = useStore((s) => s.currencyCode);
  const visibleAccountIds = useStore((s) => s.visibleAccountIds);

  const stats = useMemo(() => {
    const active = accounts.filter((a) => !a.archived);
    const selected = visibleAccountIds.length
      ? active.filter((a) => visibleAccountIds.includes(a.id))
      : active;
    const target = accountId
      ? active.filter((a) => a.id === accountId)
      : selected.length ? selected : active;
    const targetIds = new Set(target.map((a) => a.id));
    const { to } = parseRange(rangePreset, customFrom, customTo);
    const now = today();
    const ym = now.slice(0, 7);

    const sum = (map: Map<string, number>) =>
      target.reduce((total, a) => total + (map.get(a.id) ?? 0), 0);
    const current = sum(balancesAt(target, transactions, now));
    const forecast = sum(balancesAt(target, transactions, to));
    const monthNet = transactions
      .filter((t) => targetIds.has(t.accountId) && t.date.slice(0, 7) === ym)
      .reduce((total, t) => total + t.amount, 0);

    return { current, forecast, monthNet, to };
  }, [accounts, transactions, rangePreset, customFrom, customTo, accountId, visibleAccountIds]);

  return (
    <div className="overview-bar">
      <Stat
        label={targetLabel(accountId, visibleAccountIds, accounts, t)}
        value={formatMoney(stats.current, { currencyCode })}
        icon={<IconCoinMoneyStroked />}
      />
      <Stat
        label={t('stats.forecast')}
        value={formatMoney(stats.forecast, { currencyCode })}
        hint={t('stats.to', { date: formatDisplayDate(stats.to) })}
        icon={<IconHistogram />}
      />
      <Stat
        label={t('stats.monthNet')}
        value={formatMoney(stats.monthNet, { withSign: true, currencyCode })}
        tone={stats.monthNet >= 0 ? 'up' : 'down'}
        icon={<IconActivity />}
      />
    </div>
  );
}
