import { useState } from 'react';
import { Button, Popconfirm, SideSheet, Tag } from '@douyinfe/semi-ui';
import { IconDelete, IconEdit, IconPlus } from '@douyinfe/semi-icons';
import type { Transaction } from '@/types';
import EmptyState from '@/components/common/EmptyState';
import { useStore } from '@/store/useStore';
import { balanceAt } from '@/utils/balance';
import { formatMoney } from '@/utils/money';
import { formatDisplayDate } from '@/utils/locale';
import TransactionFormModal from './TransactionFormModal';
import { useI18n } from '@/i18n';

interface Props {
  visible: boolean;
  date: string;
  onClose: () => void;
}

export default function DayDetailModal({ visible, date, onClose }: Props) {
  const { t } = useI18n();
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const categories = useStore((s) => s.categories);
  const removeTransaction = useStore((s) => s.removeTransaction);
  const currencyCode = useStore((s) => s.currencyCode);

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const active = accounts.filter((a) => !a.archived);
  const dayTxs = transactions.filter((t) => t.date === date);
  const catName = (id?: string) => categories.find((c) => c.id === id)?.name;
  const accName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';

  const openCreate = () => {
    setEditing(null);
    setFormVisible(true);
  };
  const openEdit = (tx: Transaction) => {
    setEditing(tx);
    setFormVisible(true);
  };

  return (
    <SideSheet title={t('day.title', { date: formatDisplayDate(date) })} visible={visible} onCancel={onClose} width={400}>
      <div className="day-detail">
        <div className="day-detail__section-title">{t('day.balances')}</div>
        <div className="day-detail__balances">
          {active.map((a) => (
            <div className="day-balance" key={a.id}>
              <span className="account-dot" style={{ background: a.color }} />
              <span className="day-balance__name">{a.name}</span>
              <span className="mono-num">{formatMoney(balanceAt(a, transactions, date), { currencyCode })}</span>
            </div>
          ))}
        </div>

        <div className="day-detail__section-title">{t('day.changes')}</div>
        {dayTxs.length === 0 ? (
          <EmptyState title={t('day.empty')} />
        ) : (
          <div className="day-detail__list">
            {dayTxs.map((tx) => (
              <div className="day-tx" key={tx.id}>
                <div className="day-tx__main">
                  <span className="day-tx__account">{accName(tx.accountId)}</span>
                  {catName(tx.categoryId) && (
                    <Tag size="small" color="grey">
                      {catName(tx.categoryId)}
                    </Tag>
                  )}
                  {tx.note && <span className="day-tx__note">{tx.note}</span>}
                </div>
                <span className={`mono-num ${tx.amount >= 0 ? 'amount-pos' : 'amount-neg'}`}>
                  {formatMoney(tx.amount, { withSign: true, currencyCode })}
                </span>
                <Button
                  size="small"
                  theme="borderless"
                  type="tertiary"
                  icon={<IconEdit />}
                  onClick={() => openEdit(tx)}
                  aria-label={t('day.edit')}
                />
                <Popconfirm
                  title={t('day.deleteTitle')}
                  okType="danger"
                  okText={t('common.delete')}
                  cancelText={t('common.cancel')}
                  onConfirm={() => removeTransaction(tx.id)}
                >
                  <Button
                    size="small"
                    theme="borderless"
                    type="danger"
                    icon={<IconDelete />}
                    aria-label={t('common.delete')}
                  />
                </Popconfirm>
              </div>
            ))}
          </div>
        )}

        <Button block theme="solid" icon={<IconPlus />} onClick={openCreate} style={{ marginTop: 12 }}>
          {t('day.add')}
        </Button>
      </div>

      <TransactionFormModal
        visible={formVisible}
        transaction={editing}
        defaultDate={date}
        onClose={() => setFormVisible(false)}
      />
    </SideSheet>
  );
}
