import { useEffect, useMemo, useState } from 'react';
import {
  Banner,
  Button,
  Checkbox,
  Input,
  InputNumber,
  Popconfirm,
  Radio,
  RadioGroup,
  Select,
  SideSheet,
  Table,
  Toast,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { useStore } from '@/store/useStore';
import { today } from '@/utils/date';
import {
  currencyFractionDigits,
  formatMoney,
  isValidMajorAmount,
  majorToMinor,
  maximumMajorAmount,
  minorToMajor,
} from '@/utils/money';
import { formatDisplayDate } from '@/utils/locale';
import { extendRecurrence, formatRecurrenceRule, MAX_OCCURRENCES } from '@/utils/recurrence';
import RecurrencePreviewList from './RecurrencePreviewList';
import { useI18n } from '@/i18n';
import { DATA_LIMITS } from '@/config/dataLimits';

interface Props {
  visible: boolean;
  seriesId: string | null;
  onClose: () => void;
}

interface Row {
  id: string;
  date: string;
  amount: number;
  categoryName: string;
  note: string;
}

export default function SeriesManageModal({ visible, seriesId, onClose }: Props) {
  const { t } = useI18n();
  const series = useStore((s) => s.series);
  const transactions = useStore((s) => s.transactions);
  const categories = useStore((s) => s.categories);
  const accounts = useStore((s) => s.accounts);
  const batchUpdate = useStore((s) => s.batchUpdateTransactions);
  const batchDelete = useStore((s) => s.batchDeleteTransactions);
  const extendRecurring = useStore((s) => s.extendRecurring);
  const currencyCode = useStore((s) => s.currencyCode);

  const target = series.find((s) => s.id === seriesId);

  const rows = useMemo<Row[]>(() => {
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    return transactions
      .filter((t) => t.seriesId === seriesId)
      .sort((a, b) => {
        if (a.occurrenceIndex != null && b.occurrenceIndex != null) {
          return a.occurrenceIndex - b.occurrenceIndex;
        }
        const aPlanned = a.scheduledDate ?? a.date;
        const bPlanned = b.scheduledDate ?? b.date;
        return aPlanned < bPlanned ? -1 : aPlanned > bPlanned ? 1 : 0;
      })
      .map((t) => ({
        id: t.id,
        date: t.date,
        amount: t.amount,
        categoryName: t.categoryId ? catMap.get(t.categoryId) ?? '—' : '—',
        note: t.note ?? '',
      }));
  }, [transactions, categories, seriesId]);

  const [selected, setSelected] = useState<string[]>([]);
  const [editAmount, setEditAmount] = useState(false);
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [amount, setAmount] = useState(0);
  const [editCategory, setEditCategory] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState<string | undefined>();
  const [extendCount, setExtendCount] = useState(12);
  const [extendConfirmVisible, setExtendConfirmVisible] = useState(false);
  const [extendDirection, setExtendDirection] = useState<'in' | 'out'>('in');
  const [extendAmount, setExtendAmount] = useState(0);
  const [extendCategoryId, setExtendCategoryId] = useState<string | undefined>();
  const [extendNote, setExtendNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    setSelected(rows.map((r) => r.id));
    setEditAmount(false);
    setEditCategory(false);
    setAmount(0);
    setNewCategoryId(undefined);
    setDirection('in');
    setExtendCount(12);
    setExtendConfirmVisible(false);
    setExtendDirection((target?.baseAmount ?? 0) < 0 ? 'out' : 'in');
    setExtendAmount(minorToMajor(Math.abs(target?.baseAmount ?? 0), currencyCode));
    setExtendCategoryId(target?.categoryId);
    setExtendNote(target?.note ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, seriesId]);

  const t0 = today();
  const selectAll = () => setSelected(rows.map((r) => r.id));
  const invert = () => {
    const set = new Set(selected);
    setSelected(rows.filter((r) => !set.has(r.id)).map((r) => r.id));
  };
  const onlyFuture = () => setSelected(rows.filter((r) => r.date >= t0).map((r) => r.id));
  const onlyPast = () => setSelected(rows.filter((r) => r.date < t0).map((r) => r.id));

  const accName = accounts.find((a) => a.id === target?.accountId)?.name ?? '—';
  const latestDate = transactions
    .filter((t) => t.seriesId === seriesId)
    .map((t) => t.scheduledDate ?? t.date)
    .sort()
    .at(-1);
  const extensionPreview = useMemo(
    () => (target ? extendRecurrence(target, latestDate, extendCount) : null),
    [target, latestDate, extendCount],
  );
  const extendSignedAmount =
    majorToMinor(extendAmount || 0, currencyCode) * (extendDirection === 'out' ? -1 : 1);

  const handleUpdate = () => {
    if (selected.length === 0) {
      Toast.warning(t('series.selectRequired'));
      return;
    }
    if (!editAmount && !editCategory) {
      Toast.warning(t('series.fieldsRequired'));
      return;
    }
    const patch: { amount?: number; categoryId?: string } = {};
    if (editAmount) {
      if (!amount || amount <= 0 || !isValidMajorAmount(amount, currencyCode)) {
        Toast.warning(t('series.amountRequired'));
        return;
      }
      patch.amount = majorToMinor(amount, currencyCode) * (direction === 'out' ? -1 : 1);
    }
    if (editCategory) patch.categoryId = newCategoryId;
    batchUpdate(selected, patch);
    Toast.success(t('series.updated', { count: selected.length }));
    onClose();
  };

  const handleDelete = () => {
    batchDelete(selected);
    Toast.success(t('series.deleted', { count: selected.length }));
    onClose();
  };

  const handleExtend = () => {
    if (!target) return;
    if (!extendAmount || extendAmount <= 0 || !isValidMajorAmount(extendAmount, currencyCode)) {
      Toast.warning(t('series.extendAmountRequired'));
      return;
    }
    const result = extendRecurring(target.id, extendCount, {
      baseAmount: extendSignedAmount,
      categoryId: extendCategoryId,
      note: extendNote.trim() || undefined,
    });
    if (!result.added) {
      Toast.warning(t('series.noNewEntries'));
      return;
    }
    Toast.success(t('series.extended', { count: result.added, date: result.last ? formatDisplayDate(result.last) : '—' }));
    setExtendConfirmVisible(false);
    onClose();
  };

  const columns: ColumnProps<Row>[] = [
    { title: t('ledger.date'), dataIndex: 'date', width: 120, render: (date: string) => formatDisplayDate(date) },
    {
      title: t('ledger.amount'),
      dataIndex: 'amount',
      align: 'right',
      render: (v: number) => (
        <span className={`mono-num ${v >= 0 ? 'amount-pos' : 'amount-neg'}`}>
          {formatMoney(v, { withSign: true, currencyCode })}
        </span>
      ),
    },
    { title: t('ledger.category'), dataIndex: 'categoryName' },
    { title: t('ledger.note'), dataIndex: 'note', render: (n: string) => n || '—' },
  ];

  const footer = extendConfirmVisible ? (
    <div className="sheet-footer">
      <Button onClick={() => setExtendConfirmVisible(false)}>{t('series.back')}</Button>
      <Button theme="solid" onClick={handleExtend}>
        {t('series.generate', { count: extensionPreview?.dates.length ?? 0 })}
      </Button>
    </div>
  ) : (
    <div className="sheet-footer sheet-footer--split">
      <Popconfirm
        title={t('series.deleteSelectedTitle', { count: selected.length })}
        okType="danger"
        okText={t('common.delete')}
        cancelText={t('common.cancel')}
        disabled={selected.length === 0}
        onConfirm={handleDelete}
      >
        <Button theme="borderless" type="danger" disabled={selected.length === 0}>
          {t('series.deleteSelected')}
        </Button>
      </Popconfirm>
      <div className="sheet-footer__actions">
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button theme="solid" onClick={handleUpdate} disabled={selected.length === 0}>
          {t('series.apply')}
        </Button>
      </div>
    </div>
  );

  return (
    <SideSheet
      title={extendConfirmVisible ? t('series.continue') : t('series.manage')}
      visible={visible}
      onCancel={extendConfirmVisible ? () => setExtendConfirmVisible(false) : onClose}
      width="min(720px, 100vw)"
      className="product-sheet series-sheet"
      footer={footer}
    >
      {target && !extendConfirmVisible && (
        <div className="series-manage">
          <Banner
            type="info"
            closeIcon={null}
            description={
              `${accName} · ${formatRecurrenceRule(target.frequency, target.interval, t)}` +
              ` · ${t('form.amount')} ${formatMoney(target.baseAmount, { withSign: true, currencyCode })} · ${t('ledger.entries', { count: rows.length })}`
            }
          />

          <div className="series-manage__quick">
            <span className="form-label">{t('series.quickSelect')}</span>
            <Button size="small" onClick={selectAll}>{t('series.selectAll')}</Button>
            <Button size="small" onClick={invert}>{t('series.invert')}</Button>
            <Button size="small" onClick={onlyFuture}>{t('series.onlyFuture')}</Button>
            <Button size="small" onClick={onlyPast}>{t('series.onlyPast')}</Button>
            <span className="series-manage__count">{t('series.selected', { selected: selected.length, total: rows.length })}</span>
          </div>

          <Table
            columns={columns}
            dataSource={rows}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ y: 260 }}
            rowSelection={{
              selectedRowKeys: selected,
              onChange: (keys) => setSelected((keys ?? []) as string[]),
            }}
          />

          <div className="series-manage__extend">
            <div className="series-manage__extend-copy">
              <div className="series-manage__extend-title">{t('series.extend')}</div>
              <div className="series-manage__extend-desc">
                {t('series.dateRange', {
                  latest: latestDate ? formatDisplayDate(latestDate) : '—',
                  count: extensionPreview?.dates.length ?? 0,
                })}
                {extensionPreview?.dates[0] ? formatDisplayDate(extensionPreview.dates[0]) : '—'}
                {' ～ '}
                {extensionPreview?.dates.at(-1) ? formatDisplayDate(extensionPreview.dates.at(-1) ?? '') : '—'}
              </div>
            </div>
            <InputNumber
              value={extendCount}
              onNumberChange={(value) => setExtendCount(Math.min(MAX_OCCURRENCES, Math.max(1, value)))}
              min={1}
              max={MAX_OCCURRENCES}
              prefix={t('series.extend')}
              suffix={t('form.frequency')}
              style={{ width: 130 }}
            />
            <Button theme="solid" onClick={() => setExtendConfirmVisible(true)}>
              {t('series.reviewConfirm')}
            </Button>
          </div>

          <div className="series-manage__edit">
            <div className="series-manage__edit-title">{t('series.editBatch')}</div>
            <div className="series-manage__edit-row">
              <Checkbox checked={editAmount} onChange={(e) => setEditAmount(Boolean(e.target.checked))}>
                {t('ledger.amount')}
              </Checkbox>
              {editAmount && (
                <>
                  <RadioGroup
                    type="button"
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as 'in' | 'out')}
                  >
                    <Radio value="in">{t('series.deposit')}</Radio>
                    <Radio value="out">{t('series.withdraw')}</Radio>
                  </RadioGroup>
                  <InputNumber
                    value={amount}
                    onNumberChange={setAmount}
                    min={0}
                    max={maximumMajorAmount(currencyCode)}
                    prefix={currencyCode}
                    precision={currencyFractionDigits(currencyCode)}
                    style={{ width: 150 }}
                  />
                </>
              )}
            </div>
            <div className="series-manage__edit-row">
              <Checkbox checked={editCategory} onChange={(e) => setEditCategory(Boolean(e.target.checked))}>
                {t('ledger.category')}
              </Checkbox>
              {editCategory && (
                <Select
                  value={newCategoryId}
                  onChange={(v) => setNewCategoryId(v as string | undefined)}
                  placeholder={t('form.noCategory')}
                  style={{ width: 180 }}
                  showClear
                >
                  {categories.map((c) => (
                    <Select.Option key={c.id} value={c.id}>
                      {c.name}
                    </Select.Option>
                  ))}
                </Select>
              )}
            </div>
          </div>

        </div>
      )}
      {target && extensionPreview && extendConfirmVisible && (
        <div className="series-extend-confirm">
          <Banner
            type="info"
            closeIcon={null}
            description={
              `${accName} · ${formatRecurrenceRule(target.frequency, target.interval, t)}` +
              ` · ${t('series.newBatchNote')}`
            }
          />
          <div className="form-row">
            <div className="form-field form-field--grow">
              <label className="form-label">{t('series.direction')}</label>
              <RadioGroup
                type="button"
                value={extendDirection}
                onChange={(e) => setExtendDirection(e.target.value as 'in' | 'out')}
              >
                <Radio value="in">{t('series.deposit')}</Radio>
                <Radio value="out">{t('series.withdraw')}</Radio>
              </RadioGroup>
            </div>
            <div className="form-field form-field--grow">
              <label className="form-label">{t('form.amount', { code: currencyCode })}</label>
              <InputNumber
                value={extendAmount}
                onNumberChange={setExtendAmount}
                min={0}
                max={maximumMajorAmount(currencyCode)}
                prefix={currencyCode}
                precision={currencyFractionDigits(currencyCode)}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">{t('series.categoryOptional')}</label>
            <Select
              value={extendCategoryId}
              onChange={(value) => setExtendCategoryId(value as string | undefined)}
              placeholder={t('form.noCategory')}
              style={{ width: '100%' }}
              showClear
            >
              {categories.map((category) => (
                <Select.Option key={category.id} value={category.id}>
                  {category.name}
                </Select.Option>
              ))}
            </Select>
          </div>
          <div className="form-field">
            <label className="form-label">{t('series.noteOptional')}</label>
            <Input
              value={extendNote}
              onChange={setExtendNote}
              placeholder={t('series.notePlaceholder')}
              maxLength={DATA_LIMITS.noteInput}
              showClear
            />
          </div>
          <RecurrencePreviewList
            dates={extensionPreview.dates}
            amount={extendSignedAmount}
            title={t('series.pendingTitle')}
          />
        </div>
      )}
    </SideSheet>
  );
}
