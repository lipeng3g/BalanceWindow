import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Popconfirm, Select, Table, Tag } from '@douyinfe/semi-ui';
import { IconChevronDown, IconChevronRight, IconDelete, IconEdit, IconList, IconPlus } from '@douyinfe/semi-icons';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { Transaction } from '@/types';
import EmptyState from '@/components/common/EmptyState';
import TransactionFormModal from '@/components/transactions/TransactionFormModal';
import SeriesManageModal from '@/components/transactions/SeriesManageModal';
import { useStore } from '@/store/useStore';
import { today } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import { formatDisplayDate, formatDisplayMonth } from '@/utils/locale';
import { useI18n } from '@/i18n';

const SCOPES = [
  { key: 'ledger.near3', value: 3 },
  { key: 'ledger.near1y', value: 12 },
  { key: 'ledger.all', value: 0 },
];

/** 两个 YYYY-MM 之间相差的月份数（绝对值） */
function monthDistance(ymA: string, ymB: string): number {
  const [ya, ma] = ymA.split('-').map(Number);
  const [yb, mb] = ymB.split('-').map(Number);
  return Math.abs((ya - yb) * 12 + (ma - mb));
}

interface LedgerRow {
  id: string;
  date: string;
  accountName: string;
  accountColor: string;
  categoryName?: string;
  amount: number;
  note?: string;
  seriesId?: string;
}

interface MonthGroup {
  month: string;
  net: number;
  rows: LedgerRow[];
}

export default function LedgerTable({ accountId: focusedAccountId }: { accountId?: string | null }) {
  const { t } = useI18n();
  const transactions = useStore((s) => s.transactions);
  const accounts = useStore((s) => s.accounts);
  const categories = useStore((s) => s.categories);
  const currencyCode = useStore((s) => s.currencyCode);
  const removeTransaction = useStore((s) => s.removeTransaction);
  const [accountId, setAccountId] = useState<string | undefined>();
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [scopeMonths, setScopeMonths] = useState(12);
  const currentYm = today().slice(0, 7);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([currentYm]));
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [manageSeriesId, setManageSeriesId] = useState<string | null>(null);

  // 聚焦账户变化时同步账本筛选
  useEffect(() => {
    setAccountId(focusedAccountId ?? undefined);
  }, [focusedAccountId]);

  const toggleExpand = (month: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });

  const txMap = useMemo(() => new Map(transactions.map((t) => [t.id, t])), [transactions]);
  const openEdit = useCallback(
    (id: string) => {
      setEditing(txMap.get(id) ?? null);
      setFormVisible(true);
    },
    [txMap],
  );
  const openCreate = () => {
    setEditing(null);
    setFormVisible(true);
  };

  const groups = useMemo<MonthGroup[]>(() => {
    const accMap = new Map(accounts.map((a) => [a.id, a]));
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const filtered = transactions
      .filter((t) => (!accountId || t.accountId === accountId) && (!categoryId || t.categoryId === categoryId))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    const map = new Map<string, MonthGroup>();
    for (const t of filtered) {
      const ym = t.date.slice(0, 7);
      if (scopeMonths > 0 && monthDistance(ym, currentYm) > scopeMonths) continue;
      const acc = accMap.get(t.accountId);
      const cat = t.categoryId ? catMap.get(t.categoryId) : undefined;
      const group = map.get(ym) ?? { month: ym, net: 0, rows: [] };
      group.rows.push({
        id: t.id,
        date: t.date,
        accountName: acc?.name ?? '—',
        accountColor: acc?.color ?? '#ccc',
        categoryName: cat?.name,
        amount: t.amount,
        note: t.note,
        seriesId: t.seriesId,
      });
      group.net += t.amount;
      map.set(ym, group);
    }
    return [...map.values()];
  }, [transactions, accounts, categories, accountId, categoryId, scopeMonths, currentYm]);

  const columns: ColumnProps<LedgerRow>[] = useMemo(() => [
    {
      title: t('ledger.date'),
      dataIndex: 'date',
      width: 120,
      className: 'ledger-date',
      render: (date: string) => formatDisplayDate(date),
    },
    {
      title: t('ledger.account'),
      dataIndex: 'accountName',
      width: 150,
      render: (name: string, row) => (
        <span className="ledger-account">
          <span className="account-dot" style={{ background: row.accountColor }} />
          {name}
        </span>
      ),
    },
    {
      title: t('ledger.category'),
      dataIndex: 'categoryName',
      width: 110,
      render: (name?: string) => (name ? <Tag size="small" color="grey">{name}</Tag> : '—'),
    },
    {
      title: t('ledger.amount'),
      dataIndex: 'amount',
      width: 140,
      align: 'right',
      render: (amount: number) => (
        <span className={`mono-num ${amount >= 0 ? 'amount-pos' : 'amount-neg'}`}>
          {formatMoney(amount, { withSign: true, currencyCode })}
        </span>
      ),
    },
    {
      title: t('ledger.note'),
      dataIndex: 'note',
      render: (note: string | undefined, row) => (
        <span className="ledger-note">
          <span className="ledger-note__text">{note ?? ''}</span>
          {row.seriesId && (
            <Tag
              size="small"
              style={{ cursor: 'pointer', flexShrink: 0 }}
              onClick={() => setManageSeriesId(row.seriesId ?? null)}
            >
              {t('ledger.period')}
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: '',
      dataIndex: 'id',
      width: 110,
      align: 'right',
      render: (id: string, row) => (
        <span className="ledger-row-actions">
          {row.seriesId && (
            <Button
              size="small"
              theme="borderless"
              type="tertiary"
              icon={<IconList />}
              onClick={() => setManageSeriesId(row.seriesId ?? null)}
              aria-label={t('ledger.manageSeries')}
            />
          )}
          <Button
            size="small"
            theme="borderless"
            type="tertiary"
            icon={<IconEdit />}
            onClick={() => openEdit(id)}
            aria-label={t('common.edit')}
          />
          <Popconfirm
            title={t('common.delete')}
            okType="danger"
            okText={t('common.delete')}
            cancelText={t('common.cancel')}
            onConfirm={() => removeTransaction(id)}
          >
            <Button
              size="small"
              theme="borderless"
              type="danger"
              icon={<IconDelete />}
              aria-label={t('common.delete')}
            />
          </Popconfirm>
        </span>
      ),
    },
  ], [currencyCode, openEdit, removeTransaction, t]);

  return (
    <div className="ledger-area app-card">
      <div className="ledger-toolbar">
        <span className="zone-title">{t('ledger.title')}</span>
        {!focusedAccountId && (
          <Select
            placeholder={t('ledger.allAccounts')}
            value={accountId}
            onChange={(v) => setAccountId(v as string | undefined)}
            style={{ width: 140 }}
            showClear
          >
            {accounts.map((a) => (
              <Select.Option key={a.id} value={a.id}>
                {a.name}
              </Select.Option>
            ))}
          </Select>
        )}
        <Select
          placeholder={t('ledger.allCategories')}
          value={categoryId}
          onChange={(v) => setCategoryId(v as string | undefined)}
          style={{ width: 140 }}
          showClear
        >
          {categories.map((c) => (
            <Select.Option key={c.id} value={c.id}>
              {c.name}
            </Select.Option>
          ))}
        </Select>
        <Select
          value={scopeMonths}
          onChange={(v) => setScopeMonths(v as number)}
          style={{ width: 120 }}
        >
          {SCOPES.map((s) => (
            <Select.Option key={s.value} value={s.value}>
              {t(s.key)}
            </Select.Option>
          ))}
        </Select>
        <Button
          theme="light"
          icon={<IconPlus />}
          onClick={openCreate}
          style={{ marginLeft: 'auto' }}
        >
          {t('form.addTransaction')}
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState title={t('ledger.emptyTitle')} description={t('ledger.emptyDescription')} />
      ) : (
        groups.map((g) => {
          const open = expanded.has(g.month);
          return (
            <div className="ledger-group" key={g.month}>
              <button
                type="button"
                className="ledger-group__head"
                onClick={() => toggleExpand(g.month)}
                aria-expanded={open}
              >
                <span className="ledger-group__title">
                  {open ? <IconChevronDown /> : <IconChevronRight />}
                  {formatDisplayMonth(g.month)}
                  <span className="ledger-group__count">{t('ledger.entries', { count: g.rows.length })}</span>
                </span>
                <span className={`mono-num ${g.net >= 0 ? 'amount-pos' : 'amount-neg'}`}>
                  {t('ledger.net', { amount: formatMoney(g.net, { withSign: true, currencyCode }) })}
                </span>
              </button>
              {open && (
                <Table
                  columns={columns}
                  dataSource={g.rows}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  scroll={{ x: '100%' }}
                />
              )}
            </div>
          );
        })
      )}

      <TransactionFormModal
        visible={formVisible}
        transaction={editing}
        onClose={() => setFormVisible(false)}
      />
      <SeriesManageModal
        visible={manageSeriesId !== null}
        seriesId={manageSeriesId}
        onClose={() => setManageSeriesId(null)}
      />
    </div>
  );
}
