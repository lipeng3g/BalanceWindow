import { useEffect, useState } from 'react';
import { DatePicker, Input, InputNumber, Modal, Select, Toast } from '@douyinfe/semi-ui';
import type { Account } from '@/types';
import ColorSwatchPicker from '@/components/common/ColorSwatchPicker';
import { useStore } from '@/store/useStore';
import { today } from '@/utils/date';
import {
  currencyFractionDigits,
  isValidMajorAmount,
  majorToMinor,
  maximumMajorAmount,
  minorToMajor,
} from '@/utils/money';
import { randomColor } from '@/utils/palette';
import { FREE_ACCOUNT_LIMIT } from '@/config/product';
import { ACCOUNT_LIMIT_ERROR } from '@/store/slices/accountsSlice';
import { useI18n } from '@/i18n';
import { DATA_LIMITS } from '@/config/dataLimits';

interface Props {
  visible: boolean;
  account: Account | null;
  onClose: () => void;
}

export default function AccountFormModal({ visible, account, onClose }: Props) {
  const { t } = useI18n();
  const addAccount = useStore((s) => s.addAccount);
  const updateAccount = useStore((s) => s.updateAccount);
  const categories = useStore((s) => s.categories);
  const accountCount = useStore((s) => s.accounts.length);
  const currencyCode = useStore((s) => s.currencyCode);

  const [name, setName] = useState('');
  const [balance, setBalance] = useState<number>(0);
  const [openingDate, setOpeningDate] = useState(today);
  const [color, setColor] = useState(randomColor);
  const [categoryId, setCategoryId] = useState<string | undefined>();

  // 仅在弹窗"打开瞬间"按 props 重置表单值，避免 useEffect 在打字过程被覆盖；
  // 依赖用 account?.id 而非 account 对象引用，store 内对象重建不会误触发同步。
  useEffect(() => {
    if (!visible) return;
    setName(account?.name ?? '');
    setBalance(account ? minorToMajor(account.openingBalance, currencyCode) : 0);
    setOpeningDate(account?.openingDate ?? today());
    setColor(account?.color ?? randomColor());
    setCategoryId(account?.categoryId);
  }, [visible, account?.id, currencyCode]);

  const handleOk = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Toast.warning(t('accounts.nameRequired'));
      return;
    }
    if (trimmed.length > DATA_LIMITS.accountNameInput || !isValidMajorAmount(balance, currencyCode)) {
      Toast.warning(t('form.amountRequired'));
      return;
    }
    const payload = {
      name: trimmed,
      openingBalance: majorToMinor(Number.isFinite(balance) ? balance : 0, currencyCode),
      openingDate,
      color,
      categoryId,
    };
    try {
      if (account) updateAccount(account.id, payload);
      else addAccount(payload);
    } catch (error) {
      Toast.error(
        error instanceof Error && error.message === ACCOUNT_LIMIT_ERROR
          ? t('accounts.limit', { count: FREE_ACCOUNT_LIMIT })
          : t('common.unknownError'),
      );
      return;
    }
    onClose();
  };

  return (
    <Modal
      title={account ? t('accounts.edit') : t('header.newAccount')}
      visible={visible}
      onOk={handleOk}
      onCancel={onClose}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
    >
      {!account && accountCount >= FREE_ACCOUNT_LIMIT && (
        <div className="form-hint">{t('accounts.limit', { count: FREE_ACCOUNT_LIMIT })}</div>
      )}
      <div className="form-field">
        <label className="form-label">{t('accounts.name')}</label>
        <Input value={name} onChange={setName} placeholder={t('accounts.namePlaceholder')} maxLength={DATA_LIMITS.accountNameInput} showClear />
      </div>
      <div className="form-field">
        <label className="form-label">{t('accounts.openingBalance', { code: currencyCode })}</label>
        <InputNumber
          value={balance}
          onNumberChange={setBalance}
          min={-maximumMajorAmount(currencyCode)}
          max={maximumMajorAmount(currencyCode)}
          style={{ width: '100%' }}
          precision={currencyFractionDigits(currencyCode)}
          placeholder={t('accounts.negativeAllowed')}
        />
        <div className="form-hint">{t('accounts.openingBalanceHint')}</div>
      </div>
      <div className="form-field">
        <label className="form-label">{t('accounts.openingDate')}</label>
        <DatePicker
          type="date"
          value={openingDate}
          onChange={(_, str) => setOpeningDate(typeof str === 'string' ? str : openingDate)}
          style={{ width: '100%' }}
        />
      </div>
      <div className="form-field">
        <label className="form-label">{t('form.categoryOptional')}</label>
        <Select
          value={categoryId}
          onChange={(v) => setCategoryId(v as string | undefined)}
          placeholder={t('form.noCategory')}
          style={{ width: '100%' }}
          showClear
        >
          {categories.map((c) => (
            <Select.Option key={c.id} value={c.id}>
              {c.name}
            </Select.Option>
          ))}
        </Select>
      </div>
      <div className="form-field">
        <label className="form-label">{t('categories.color')}</label>
        <ColorSwatchPicker value={color} onChange={setColor} />
      </div>
    </Modal>
  );
}
