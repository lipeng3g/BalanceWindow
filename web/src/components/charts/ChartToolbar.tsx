import { Button, DatePicker, Radio, RadioGroup, Select } from '@douyinfe/semi-ui';
import { IconHistory } from '@douyinfe/semi-icons';
import type { Granularity } from '@/types';
import { useStore } from '@/store/useStore';
import { useI18n } from '@/i18n';

const RANGES = [
  { key: 'chart.past3Future1', value: 'P3M-F12M' },
  { key: 'chart.past1Future1', value: 'P12M-F12M' },
  { key: 'chart.future1', value: 'P0M-F12M' },
  { key: 'chart.future2', value: 'P0M-F24M' },
  { key: 'chart.future5', value: 'P0M-F60M' },
  { key: 'chart.future10', value: 'P0M-F120M' },
  { key: 'chart.future20', value: 'P0M-F240M' },
  { key: 'chart.past5Future5', value: 'P60M-F60M' },
  { key: 'chart.custom', value: 'custom' },
];
const TOTAL_COLOR = '#64748b';

export default function ChartToolbar({ accountId }: { accountId?: string | null }) {
  const { t } = useI18n();
  const granularity = useStore((s) => s.granularity);
  const setGranularity = useStore((s) => s.setGranularity);
  const rangePreset = useStore((s) => s.rangePreset);
  const setRangePreset = useStore((s) => s.setRangePreset);
  const customFrom = useStore((s) => s.customFrom);
  const customTo = useStore((s) => s.customTo);
  const setCustomRange = useStore((s) => s.setCustomRange);
  const showTotal = useStore((s) => s.showTotal);
  const toggleTotal = useStore((s) => s.toggleTotal);
  const accounts = useStore((s) => s.accounts);
  const visibleAccountIds = useStore((s) => s.visibleAccountIds);
  const setVisibleAccountIds = useStore((s) => s.setVisibleAccountIds);

  const active = accounts.filter((a) => !a.archived);
  const allIds = active.map((a) => a.id);
  const configured = visibleAccountIds.filter((id) => allIds.includes(id));
  const effective = configured.length ? configured : allIds;

  const handleToggleAccount = (id: string) => {
    const next = effective.includes(id)
      ? effective.filter((x) => x !== id)
      : [...effective, id];
    if (next.length === 0 && !showTotal) toggleTotal();
    setVisibleAccountIds(next.length === allIds.length ? [] : next);
  };

  return (
    <div className="chart-toolbar">
      <div className="chart-toolbar__row">
        <RadioGroup
          type="button"
          value={granularity}
          onChange={(e) => setGranularity(e.target.value as Granularity)}
        >
          <Radio value="day">{t('chart.day')}</Radio>
          <Radio value="week">{t('chart.week')}</Radio>
          <Radio value="month">{t('chart.month')}</Radio>
        </RadioGroup>
        <Select
          value={rangePreset}
          onChange={(v) => setRangePreset(v as string)}
          style={{ width: 210 }}
        >
          {RANGES.map((r) => (
            <Select.Option key={r.value} value={r.value}>
              {t(r.key)}
            </Select.Option>
          ))}
        </Select>
        <Button
          size="small"
          theme="borderless"
          type={rangePreset === 'P12M-F12M' ? 'primary' : 'tertiary'}
          icon={<IconHistory />}
          onClick={() => setRangePreset('P12M-F12M')}
        >
          {t('chart.previousNextYear')}
        </Button>
        {rangePreset === 'custom' && (
          <DatePicker
            type="dateRange"
            density="compact"
            value={customFrom && customTo ? [customFrom, customTo] : undefined}
            onChange={(_, str) => {
              const [from, to] = str as string[];
              if (from && to) setCustomRange(from, to);
            }}
            style={{ width: 260 }}
          />
        )}
      </div>

      {!accountId && active.length > 0 && (
        <div className="chart-toolbar__chips">
          <button
            type="button"
            className={`chip${showTotal ? ' is-on' : ''}`}
            onClick={toggleTotal}
          >
            <span className="account-dot" style={{ background: TOTAL_COLOR }} />
            {t('chart.total')}
          </button>
          {active.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`chip${effective.includes(a.id) ? ' is-on' : ''}`}
              onClick={() => handleToggleAccount(a.id)}
            >
              <span className="account-dot" style={{ background: a.color }} />
              {a.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
