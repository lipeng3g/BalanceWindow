import { useEffect, useState } from 'react';
import { formatMoney } from '@/utils/money';
import { formatDisplayDate } from '@/utils/locale';
import { useStore } from '@/store/useStore';
import { useI18n } from '@/i18n';

const MAX_VISIBLE_ROWS = 100;
const HEAD_ROWS = 80;
const TAIL_ROWS = 20;

interface Props {
  dates: string[];
  amount: number;
  title?: string;
}

interface PreviewRow {
  date: string;
  index: number;
}

export default function RecurrencePreviewList({ dates, amount, title }: Props) {
  const { t } = useI18n();
  const heading = title ?? t('preview.title');
  const currencyCode = useStore((s) => s.currencyCode);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [dates]);

  const rows: Array<PreviewRow | null> =
    dates.length <= MAX_VISIBLE_ROWS
      ? dates.map((date, index) => ({ date, index }))
      : [
          ...dates.slice(0, HEAD_ROWS).map((date, index) => ({ date, index })),
          null,
          ...dates.slice(-TAIL_ROWS).map((date, offset) => ({
            date,
            index: dates.length - TAIL_ROWS + offset,
          })),
        ];
  const omitted = Math.max(0, dates.length - MAX_VISIBLE_ROWS);

  return (
    <div className={`recurrence-preview${expanded ? ' is-expanded' : ''}`}>
      <div className="recurrence-preview__head">
        <span className="recurrence-preview__heading">
          <strong>{heading}</strong>
          {dates.length > 0 && (
            <span>{formatDisplayDate(dates[0])} ～ {formatDisplayDate(dates.at(-1) ?? dates[0])}</span>
          )}
        </span>
        <span>{t('preview.count', { count: dates.length })}</span>
      </div>
      <div className="recurrence-preview__list" role="table" aria-label={heading}>
        <div className="recurrence-preview__row recurrence-preview__row--head" role="row">
          <span role="columnheader">{t('preview.index')}</span>
          <span role="columnheader">{t('preview.date')}</span>
          <span role="columnheader">{t('preview.amount')}</span>
        </div>
        {rows.map((row) =>
          row ? (
            <div className="recurrence-preview__row" role="row" key={`${row.index}-${row.date}`}>
              <span role="cell">{row.index + 1}</span>
              <span role="cell" className="mono-num">{formatDisplayDate(row.date)}</span>
              <span
                role="cell"
                className={`mono-num ${amount >= 0 ? 'amount-pos' : 'amount-neg'}`}
              >
                {formatMoney(amount, { withSign: true, currencyCode })}
              </span>
            </div>
          ) : (
            <div className="recurrence-preview__omitted" key="omitted">
              {t('preview.omitted', { count: omitted })}
            </div>
          ),
        )}
      </div>
      <div className="recurrence-preview__foot">
        <span>
          {omitted > 0
            ? t('preview.summary', { head: HEAD_ROWS, tail: TAIL_ROWS, count: omitted })
            : t('preview.scrollHint')}
        </span>
        <button
          type="button"
          className="recurrence-preview__toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? t('preview.collapse') : t('preview.expand')}
        </button>
      </div>
    </div>
  );
}
