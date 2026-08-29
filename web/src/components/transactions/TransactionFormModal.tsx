import { useEffect, useMemo, useState } from 'react';
import {
  Banner,
  Button,
  Checkbox,
  DatePicker,
  Input,
  InputNumber,
  Radio,
  RadioGroup,
  Select,
  SideSheet,
  Switch,
  Toast,
} from '@douyinfe/semi-ui';
import type { Frequency, RecurrenceEnd, Transaction } from '@/types';
import { useStore } from '@/store/useStore';
import { addMonths, today } from '@/utils/date';
import { currencyFractionDigits, isValidMajorAmount, majorToMinor, maximumMajorAmount, minorToMajor } from '@/utils/money';
import { formatDisplayDate } from '@/utils/locale';
import {
  formatRecurrenceRule,
  MAX_OCCURRENCES,
  RECURRING_FREQUENCIES,
  recurrenceDates,
} from '@/utils/recurrence';
import RecurrencePreviewList from './RecurrencePreviewList';
import { useI18n } from '@/i18n';
import { DATA_LIMITS } from '@/config/dataLimits';

interface Props {
  visible: boolean;
  transaction?: Transaction | null;
  defaultDate?: string;
  defaultAccountId?: string;
  onClose: () => void;
}

export default function TransactionFormModal({
  visible,
  transaction,
  defaultDate,
  defaultAccountId,
  onClose,
}: Props) {
  const { t } = useI18n();
  const accounts = useStore((s) => s.accounts);
  const categories = useStore((s) => s.categories);
  const addTransaction = useStore((s) => s.addTransaction);
  const addRecurring = useStore((s) => s.addRecurring);
  const updateTransaction = useStore((s) => s.updateTransaction);
  const updateRecurringFrom = useStore((s) => s.updateRecurringFrom);
  const currencyCode = useStore((s) => s.currencyCode);

  const isEdit = Boolean(transaction);
  const activeAccounts = accounts.filter((a) => !a.archived);

  const [accountId, setAccountId] = useState<string | undefined>();
  const [date, setDate] = useState(today);
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [amount, setAmount] = useState<number>(0);
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [note, setNote] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [interval, setIntervalValue] = useState(1);
  const [endKind, setEndKind] = useState<'count' | 'until'>('count');
  const [count, setCount] = useState(12);
  const [until, setUntil] = useState(() => addMonths(today(), 12));
  const [recurringScope, setRecurringScope] = useState<'single' | 'fromHere'>('single');
  const [overwriteRecurringOverrides, setOverwriteRecurringOverrides] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (transaction) {
      setAccountId(transaction.accountId);
      setDate(transaction.date);
      setDirection(transaction.amount < 0 ? 'out' : 'in');
      setAmount(Math.abs(minorToMajor(transaction.amount, currencyCode)));
      setCategoryId(transaction.categoryId);
      setNote(transaction.note ?? '');
      setRecurring(false);
      setRecurringScope('single');
      setOverwriteRecurringOverrides(false);
    } else {
      setAccountId(defaultAccountId ?? activeAccounts[0]?.id);
      setDate(defaultDate ?? today());
      setDirection('in');
      setAmount(0);
      setCategoryId(undefined);
      setNote('');
      setRecurring(false);
      setFrequency('monthly');
      setIntervalValue(1);
      setEndKind('count');
      setCount(12);
      setUntil(addMonths(today(), 12));
      setOverwriteRecurringOverrides(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, transaction, currencyCode]);

  const end: RecurrenceEnd =
    endKind === 'count' ? { kind: 'count', count } : { kind: 'until', date: until };

  const preview = useMemo(() => {
    if (!recurring || !accountId) return null;
    const dates = recurrenceDates({
      accountId,
      frequency,
      interval,
      baseAmount: 1,
      startDate: date,
      end,
    });
    return { count: dates.length, dates };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurring, accountId, frequency, interval, date, endKind, count, until]);

  const ruleExampleDates = useMemo(
    () => recurrenceDates({
      accountId: accountId ?? '',
      frequency,
      interval,
      baseAmount: 0,
      startDate: date,
      end: { kind: 'count', count: 3 },
    }),
    [accountId, frequency, interval, date],
  );
  const previewAmount = majorToMinor(amount || 0, currencyCode) * (direction === 'out' ? -1 : 1);

  const handleOk = () => {
    if (!accountId) {
      Toast.warning(t('form.accountRequired'));
      return;
    }
    if (!amount || amount <= 0 || !isValidMajorAmount(amount, currencyCode)) {
      Toast.warning(t('form.amountRequired'));
      return;
    }
    const signed = majorToMinor(amount, currencyCode) * (direction === 'out' ? -1 : 1);

    if (isEdit && transaction) {
      if (transaction.seriesId && recurringScope === 'fromHere') {
        const result = updateRecurringFrom(
          transaction.id,
          { amount: signed, categoryId, note },
          { overwriteOverrides: overwriteRecurringOverrides },
        );
        if (date !== transaction.date) updateTransaction(transaction.id, { date });
        Toast.success(t('form.updatedSeries', { updated: result.updated, preserved: result.preserved }));
      } else {
        updateTransaction(transaction.id, { accountId, date, amount: signed, categoryId, note });
      }
    } else if (recurring) {
      if (preview && preview.count >= MAX_OCCURRENCES) {
        Toast.error(t('form.maxOccurrences', { count: MAX_OCCURRENCES }));
        return;
      }
      addRecurring({
        accountId,
        frequency,
        interval,
        baseAmount: signed,
        startDate: date,
        end,
        categoryId,
        note,
      });
    } else {
      addTransaction({ accountId, date, amount: signed, categoryId, note });
    }
    onClose();
  };

  return (
    <SideSheet
      title={isEdit ? t('form.editTransaction') : t('form.addTransaction')}
      visible={visible}
      onCancel={onClose}
      width="min(520px, 100vw)"
      className="product-sheet transaction-sheet"
      footer={
        <div className="sheet-footer">
          <Button onClick={onClose}>{t('form.cancel')}</Button>
          <Button
            theme="solid"
            onClick={handleOk}
            disabled={activeAccounts.length === 0}
          >
            {recurring && preview ? t('form.generate', { count: preview.count }) : t('form.save')}
          </Button>
        </div>
      }
    >
      {activeAccounts.length === 0 ? (
        <Banner type="warning" description={t('form.noAccount')} />
      ) : (
        <>
          <div className="form-field">
            <label className="form-label">{t('form.account')}</label>
            <Select
              value={accountId}
              onChange={(v) => setAccountId(v as string)}
              disabled={Boolean(transaction?.seriesId)}
              style={{ width: '100%' }}
              placeholder={t('form.chooseAccount')}
            >
              {activeAccounts.map((a) => (
                <Select.Option key={a.id} value={a.id}>
                  {a.name}
                </Select.Option>
              ))}
            </Select>
            {transaction?.seriesId && (
              <div className="form-hint">{t('form.recurringAccountHint')}</div>
            )}
          </div>

          <div className="form-row">
            <div className="form-field form-field--grow">
              <label className="form-label">{t('form.direction')}</label>
              <RadioGroup
                type="button"
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'in' | 'out')}
              >
                <Radio value="in">{t('form.income')}</Radio>
                <Radio value="out">{t('form.expense')}</Radio>
              </RadioGroup>
            </div>
            <div className="form-field form-field--grow">
              <label className="form-label">{t('form.amount', { code: currencyCode })}</label>
              <InputNumber
                value={amount}
                onNumberChange={setAmount}
                min={0}
                max={maximumMajorAmount(currencyCode)}
                precision={currencyFractionDigits(currencyCode)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">{recurring ? t('form.startDate') : t('form.date')}</label>
            <DatePicker
              type="date"
              value={date}
              onChange={(_, str) => setDate(typeof str === 'string' ? str : date)}
              style={{ width: '100%' }}
            />
          </div>

          {isEdit && transaction?.seriesId && (
            <div className="form-field">
              <label className="form-label">{t('form.scope')}</label>
              <RadioGroup
                type="button"
                value={recurringScope}
                onChange={(event) => setRecurringScope(event.target.value as 'single' | 'fromHere')}
              >
                <Radio value="single">{t('form.single')}</Radio>
                <Radio value="fromHere">{t('form.fromHere')}</Radio>
              </RadioGroup>
              {recurringScope === 'fromHere' && (
                <div className="form-hint">
                  {t('form.fromHereHint')}
                </div>
              )}
              {recurringScope === 'fromHere' && (
                <Checkbox
                  checked={overwriteRecurringOverrides}
                  onChange={(event) => setOverwriteRecurringOverrides(Boolean(event.target.checked))}
                >
                  {t('form.overwriteOverrides')}
                </Checkbox>
              )}
            </div>
          )}

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
            <label className="form-label">{t('form.noteOptional')}</label>
            <Input value={note} onChange={setNote} placeholder={t('form.notePlaceholder')} maxLength={DATA_LIMITS.noteInput} showClear />
          </div>

          {!isEdit && (
            <div className="form-field form-field--inline">
              <span className="form-label">{t('form.recurring')}</span>
              <Switch checked={recurring} onChange={setRecurring} />
            </div>
          )}

          {!isEdit && recurring && (
            <div className="recurrence-box">
              <div className="form-row">
                <div className="form-field form-field--grow">
                  <label className="form-label">{t('form.frequency')}</label>
                  <Select
                    value={frequency}
                    onChange={(v) => setFrequency(v as Frequency)}
                    style={{ width: '100%' }}
                  >
                    {RECURRING_FREQUENCIES.map((f) => (
                      <Select.Option key={f} value={f}>
                        {t(`frequency.${f}`)}
                      </Select.Option>
                    ))}
                  </Select>
                </div>
                <div className="form-field form-field--grow">
                  <label className="form-label">{t('form.rule')}</label>
                  <InputNumber
                    value={interval}
                    onNumberChange={(v) => setIntervalValue(Math.min(DATA_LIMITS.recurrenceInterval, Math.max(1, v)))}
                    min={1}
                    max={DATA_LIMITS.recurrenceInterval}
                    prefix={t('form.everyPrefix')}
                    suffix={t('form.intervalSuffix', { unit: t(`frequency.${frequency}`) })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className="recurrence-rule-hint">
                {formatRecurrenceRule(frequency, interval, t)}：
                {ruleExampleDates.map((value) => formatDisplayDate(value)).join('、')}
                {ruleExampleDates.length ? '……' : ''}
              </div>

              <div className="form-field">
                <label className="form-label">{t('form.endCondition')}</label>
                <RadioGroup
                  value={endKind}
                  onChange={(e) => setEndKind(e.target.value as 'count' | 'until')}
                >
                  <Radio value="count">{t('form.count')}</Radio>
                  <Radio value="until">{t('form.until')}</Radio>
                </RadioGroup>
              </div>

              {endKind === 'count' ? (
                <InputNumber
                  value={count}
                  onNumberChange={(v) => setCount(Math.min(MAX_OCCURRENCES, Math.max(1, v)))}
                  min={1}
                  max={MAX_OCCURRENCES}
                  prefix={t('form.totalPrefix')}
                  suffix={t('form.entryUnit')}
                  style={{ width: '100%' }}
                />
              ) : (
                <DatePicker
                  type="date"
                  value={until}
                  onChange={(_, str) => setUntil(typeof str === 'string' ? str : until)}
                  style={{ width: '100%' }}
                />
              )}

              {preview && (preview.count === 0 || preview.count >= MAX_OCCURRENCES) && (
                <Banner
                  type={preview.count >= MAX_OCCURRENCES ? 'danger' : 'info'}
                  description={
                    preview.count >= MAX_OCCURRENCES
                      ? t('form.maxOccurrences', { count: MAX_OCCURRENCES })
                      : t('form.noPreview')
                  }
                  closeIcon={null}
                />
              )}
              {preview && preview.count > 0 && (
                <RecurrencePreviewList dates={preview.dates} amount={previewAmount} />
              )}
              <div className="form-hint">{t('form.monthEndHint')}</div>
            </div>
          )}
        </>
      )}
    </SideSheet>
  );
}
