import {
  LANGUAGE_LOCALES,
  detectSystemLanguage,
  readLanguagePreference,
  resolveLanguage,
  type LanguageCode,
} from '@/i18n/config';

export type DisplayDateStyle = 'date' | 'month' | 'year';

export function currentLanguage(): LanguageCode {
  const preference = readLanguagePreference();
  return resolveLanguage(preference, typeof navigator === 'undefined' ? '' : navigator.language);
}

export function currentLocale(): string {
  return LANGUAGE_LOCALES[currentLanguage()];
}

function localDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(Number.NaN);
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

function isoDate(value: string | Date): string {
  const date = localDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Data remains YYYY-MM-DD internally. Simplified Chinese keeps that compact
 * representation for backwards-compatible Web tests and existing workflows;
 * every other shipped locale receives a real localized date.
 */
export function formatDisplayDate(value: string | Date, style: DisplayDateStyle = 'date'): string {
  const language = currentLanguage();
  const parsed = localDate(value);
  if (!isValidDate(parsed)) return String(value);
  if (language === 'zh-Hans') {
    const iso = isoDate(parsed);
    return style === 'date' ? iso : style === 'month' ? iso.slice(0, 7) : iso.slice(0, 4);
  }
  const options: Intl.DateTimeFormatOptions = style === 'year'
    ? { year: 'numeric' }
    : style === 'month'
      ? { year: 'numeric', month: 'short' }
      : { year: 'numeric', month: 'short', day: 'numeric' };
  return new Intl.DateTimeFormat(currentLocale(), options).format(parsed);
}

export function formatDisplayMonth(value: string): string {
  return formatDisplayDate(`${value}-01`, 'month');
}

export function formatChartDate(value: string, granularity: 'day' | 'week' | 'month' | 'year'): string {
  if (currentLanguage() === 'zh-Hans') {
    if (granularity === 'month') return value.slice(0, 7);
    if (granularity === 'year') return value.slice(0, 4);
    return value;
  }
  if (granularity === 'year') return formatDisplayDate(value, 'year');
  if (granularity === 'month') return formatDisplayDate(value, 'month');
  return formatDisplayDate(value, 'date');
}

export function formatDisplayNumber(value: number, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(currentLocale(), options).format(value);
}

/** Used by tests and SSR-like callers that need a deterministic language. */
export function localeForLanguage(language: LanguageCode): string {
  return LANGUAGE_LOCALES[language] ?? LANGUAGE_LOCALES[detectSystemLanguage()];
}
