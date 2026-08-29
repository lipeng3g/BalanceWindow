import { useEffect, useMemo, useState } from 'react';
import { VChart } from '@visactor/react-vchart';
import type { ISpec } from '@visactor/react-vchart';
import { Button } from '@douyinfe/semi-ui';
import { IconEyeClosed, IconEyeOpened, IconRefresh } from '@douyinfe/semi-icons';
import EmptyState from '@/components/common/EmptyState';
import { TOTAL_NAME, useChartData } from '@/hooks/useChartData';
import { useStore } from '@/store/useStore';
import { currencyFractionDigits, formatCompactMajor, formatMoney } from '@/utils/money';
import { formatChartDate } from '@/utils/locale';
import { useI18n } from '@/i18n';

const PALETTE = {
  light: { axis: '#64748b', grid: 'rgba(100,116,139,0.12)', bg: '#ffffff' },
  dark: { axis: '#94a3b8', grid: 'rgba(148,163,184,0.16)', bg: '#1c1f26' },
} as const;

interface Props {
  onDayClick?: (date: string) => void;
  /** 聚焦查看的单个账户；为空展示总资产 + 各账户 */
  accountId?: string | null;
}

export default function BalanceChart({ onDayClick, accountId }: Props) {
  const { t } = useI18n();
  const { values, series, labelToDate, from, to, todayLabel } = useChartData(accountId);
  const theme = useStore((s) => s.theme);
  const showLabels = useStore((s) => s.showChartLabels);
  const toggleChartLabels = useStore((s) => s.toggleChartLabels);
  const granularity = useStore((s) => s.granularity);
  const currencyCode = useStore((s) => s.currencyCode);
  const visibleAccountIds = useStore((s) => s.visibleAccountIds);
  const showTotal = useStore((s) => s.showTotal);
  const [zoomKey, setZoomKey] = useState(0);
  const phaseLabel = (phase: unknown) => phase === 'forecast' ? t('chart.phaseForecast') : t('chart.phaseHistory');

  // 数据视窗维度变化时（范围/粒度/可见账户）自动复位缩放，避免上次缩放百分比裁剪新数据
  useEffect(() => {
    setZoomKey((k) => k + 1);
  }, [from, to, granularity, accountId, visibleAccountIds, showTotal]);

  const spec = useMemo<ISpec>(() => {
    const c = PALETTE[theme];
    const futureEnd = values.reduce<{ date: string; time: string } | null>(
      (latest, value) => (!latest || value.date > latest.date ? { date: value.date, time: value.time } : latest),
      null,
    );
    const hasForecast = values.some((value) => value.phase === 'forecast');
    return {
      type: 'line',
      autoFit: true,
      background: 'transparent',
      data: [{ id: 'balance', values }],
      xField: 'time',
      yField: 'value',
      seriesField: 'type',
      color: series.map((s) => s.color),
      line: {
        style: {
          lineWidth: (datum: Record<string, unknown>) => datum?.type === TOTAL_NAME ? 3 : 1.8,
          curveType: 'monotone',
          lineDash: (datum: Record<string, unknown>) => datum?.phase === 'forecast' ? [7, 5] : [],
          strokeOpacity: (datum: Record<string, unknown>) => datum?.type === TOTAL_NAME ? 1 : 0.78,
        },
      },
      point: {
        visible: false,
        state: { hover: { size: 8 } },
      },
      ...(showLabels && {
        label: {
          visible: true,
          position: 'top',
          overlap: { hideOnHit: true },
          style: { fontSize: 10, fontWeight: 500, fill: c.axis },
          formatMethod: (_text: string | string[], datum?: Record<string, unknown>) =>
            formatMoney(Math.round(Number(datum?.value ?? 0) * (10 ** currencyFractionDigits(currencyCode))), { currencyCode }),
        },
      }),
      crosshair: { xField: { visible: true, line: { type: 'line' } } },
      tooltip: {
        dimension: {
          title: { value: (d) => t('chart.tooltipPhase', { time: formatChartDate(String(d?.time ?? ''), granularity), phase: phaseLabel(d?.phase) }) },
          content: [
            {
              key: (d) => d?.type,
              value: (d) => formatMoney(Math.round(Number(d?.value ?? 0) * (10 ** currencyFractionDigits(currencyCode))), { currencyCode }),
            },
          ],
        },
        mark: {
          title: { value: (d) => t('chart.tooltipPhase', { time: formatChartDate(String(d?.time ?? ''), granularity), phase: phaseLabel(d?.phase) }) },
          content: [
            {
              key: (d) => d?.type,
              value: (d) => formatMoney(Math.round(Number(d?.value ?? 0) * (10 ** currencyFractionDigits(currencyCode))), { currencyCode }),
            },
          ],
        },
      },
      ...(todayLabel && {
        markLine: [
          {
            x: todayLabel,
            interactive: false,
            line: { style: { stroke: c.axis, lineDash: [4, 4], strokeOpacity: 0.7 } },
            label: {
              visible: true,
              text: t('chart.today'),
              position: 'end',
              style: { fill: c.axis, fontSize: 11, fontWeight: 600 },
              labelBackground: { visible: false },
            },
          },
        ],
      }),
      ...(todayLabel && hasForecast && futureEnd && {
        markArea: [
          {
            x: todayLabel,
            x1: futureEnd.time,
            interactive: false,
            area: { style: { fill: c.axis, fillOpacity: theme === 'dark' ? 0.07 : 0.04 } },
            label: { visible: false },
          },
        ],
      }),
      dataZoom: [
        {
          orient: 'bottom',
          filterMode: 'filter',
          roamDrag: true,
          roamZoom: false,
          showDetail: true,
          height: 28,
        },
      ],
      axes: [
        {
          orient: 'bottom',
          label: {
            style: { fill: c.axis },
            formatMethod: (value) => formatChartDate(String(value), granularity),
          },
        },
        {
          orient: 'left',
          label: {
            style: { fill: c.axis },
            formatMethod: (val) => formatCompactMajor(Number(val), currencyCode),
          },
          grid: { visible: true, style: { stroke: c.grid } },
        },
      ],
    };
  }, [values, series, theme, showLabels, currencyCode, granularity, t]);

  if (!values.length) {
    return (
      <div className="chart-host chart-host--empty">
        <EmptyState title={t('main.chartEmptyTitle')} description={t('main.chartEmptyDescription')} />
      </div>
    );
  }

  const handleDimensionClick = (e: { dimensionInfo?: { value?: string }[] }) => {
    const label = e?.dimensionInfo?.[0]?.value;
    if (label && onDayClick) onDayClick(labelToDate[label] ?? label);
  };

  return (
    <div className="chart-host">
      <div className="chart-host__hint">
        <div className="chart-phase-legend" aria-label={t('chart.phaseAria')}>
          <span><i className="chart-phase-line" />{t('chart.history')}</span>
          <span><i className="chart-phase-line chart-phase-line--forecast" />{t('chart.forecastPhase')}</span>
        </div>
        <div className="chart-host__hint-actions">
          <Button
            size="small"
            theme="borderless"
            type={showLabels ? 'primary' : 'tertiary'}
            icon={showLabels ? <IconEyeOpened /> : <IconEyeClosed />}
            onClick={toggleChartLabels}
          >
            {showLabels ? t('chart.hideAmount') : t('chart.showAmount')}
          </Button>
          <Button
            size="small"
            theme="borderless"
            type="tertiary"
            icon={<IconRefresh />}
            onClick={() => setZoomKey((k) => k + 1)}
          >
            {t('chart.reset')}
          </Button>
        </div>
      </div>
      <div className="chart-host__canvas">
        <VChart key={zoomKey} spec={spec} onDimensionClick={handleDimensionClick} />
      </div>
    </div>
  );
}
