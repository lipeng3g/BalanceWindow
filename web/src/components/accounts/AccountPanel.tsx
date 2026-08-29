import { useMemo, useState } from 'react';
import { Button, Toast } from '@douyinfe/semi-ui';
import { IconHome, IconPlus } from '@douyinfe/semi-icons';
import type { Account } from '@/types';
import EmptyState from '@/components/common/EmptyState';
import { useStore } from '@/store/useStore';
import { balancesAt } from '@/utils/balance';
import { today } from '@/utils/date';
import AccountCard from './AccountCard';
import AccountFormModal from './AccountFormModal';
import { FREE_ACCOUNT_LIMIT } from '@/config/product';
import { useI18n } from '@/i18n';

interface Props {
  /** 当前聚焦的账户 id；null 表示查看全部 */
  focusedAccountId?: string | null;
  onFocusAccount?: (id: string | null) => void;
}

export default function AccountPanel({ focusedAccountId, onFocusAccount }: Props) {
  const { t } = useI18n();
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const { active, archived } = useMemo(
    () => ({
      active: accounts.filter((a) => !a.archived),
      archived: accounts.filter((a) => a.archived),
    }),
    [accounts],
  );

  // 一次分组遍历算出所有账户余额，避免每张卡片各自全量扫描
  const balances = useMemo(
    () => balancesAt(accounts, transactions, today()),
    [accounts, transactions],
  );

  const openCreate = () => {
    if (accounts.length >= FREE_ACCOUNT_LIMIT) {
      Toast.warning(t('accounts.limit', { count: FREE_ACCOUNT_LIMIT }));
      return;
    }
    setEditing(null);
    setFormVisible(true);
  };
  const openEdit = (account: Account) => {
    setEditing(account);
    setFormVisible(true);
  };

  const focus = (id: string) => onFocusAccount?.(focusedAccountId === id ? null : id);

  return (
    <div className="account-panel">
      <div className="account-panel__head">
        <span className="account-panel__title">{t('accounts.title')}</span>
        <span className="account-panel__count">{accounts.length}</span>
      </div>

      <button
        type="button"
        className={`account-panel__all${!focusedAccountId ? ' is-on' : ''}`}
        onClick={() => onFocusAccount?.(null)}
        aria-label={t('accounts.viewAll')}
        title={t('accounts.viewAll')}
      >
        <span className="account-panel__all-icon"><IconHome /></span>
        <span className="account-panel__all-label">{t('accounts.all')}</span>
      </button>

      {accounts.length === 0 ? (
        <EmptyState
          title={t('accounts.emptyTitle')}
          description={t('accounts.emptyDescription')}
          action={
            <Button theme="solid" icon={<IconPlus />} onClick={openCreate}>
              {t('header.newAccount')}
            </Button>
          }
        />
      ) : (
        <div className="account-strip">
          {active.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              balance={balances.get(a.id) ?? 0}
              onEdit={openEdit}
              focused={focusedAccountId === a.id}
              onFocus={onFocusAccount ? () => focus(a.id) : undefined}
            />
          ))}
          {archived.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              balance={balances.get(a.id) ?? 0}
              onEdit={openEdit}
              focused={focusedAccountId === a.id}
              onFocus={onFocusAccount ? () => focus(a.id) : undefined}
            />
          ))}
          <button type="button" className="account-add" onClick={openCreate}>
            <IconPlus />
            <span className="account-add__label">{accounts.length >= FREE_ACCOUNT_LIMIT ? t('accounts.limitReached') : t('header.newAccount')}</span>
          </button>
        </div>
      )}

      <AccountFormModal
        visible={formVisible}
        account={editing}
        onClose={() => setFormVisible(false)}
      />
    </div>
  );
}
