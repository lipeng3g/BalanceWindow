import { beforeEach, describe, expect, it } from 'vitest';
import { formatChartDate, formatDisplayDate, formatDisplayMonth, formatDisplayNumber, localeForLanguage } from '@/utils/locale';
import { formatMoney } from '@/utils/money';

describe('display locale formatting', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps internal ISO dates readable in the default Simplified Chinese UI', () => {
    expect(formatDisplayDate('2026-06-10')).toBe('2026-06-10');
    expect(formatDisplayMonth('2026-06')).toBe('2026-06');
    expect(formatChartDate('2026-06-10', 'month')).toBe('2026-06');
  });

  it.each(['zh-Hant', 'en', 'ja', 'de', 'es'] as const)('formats dates for %s instead of exposing ISO strings', (language) => {
    window.localStorage.setItem('balance-window:language', language);
    expect(formatDisplayDate('2026-06-10')).not.toBe('2026-06-10');
    expect(formatDisplayMonth('2026-06')).not.toBe('2026-06');
    expect(formatChartDate('2026-06-10', 'month')).not.toBe('2026-06');
    expect(localeForLanguage(language)).toBeTruthy();
  });

  it('uses the selected UI locale for numbers and currency separators', () => {
    window.localStorage.setItem('balance-window:language', 'de');
    expect(formatDisplayNumber(1234567.89)).toContain(',');
    expect(formatMoney(1234, { currencyCode: 'EUR' })).toContain('12,34');
  });
});
