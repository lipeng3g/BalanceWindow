import type { CurrencyCode, Money } from '@/types';
import { currentLanguage, currentLocale } from './locale';

export const DEFAULT_CURRENCY_CODE = 'CNY';
export const MAX_SAFE_MONEY = Number.MAX_SAFE_INTEGER;

export interface CurrencyOption {
  code: CurrencyCode;
  name: string;
  locale: string;
}

/** 常用 ISO 4217 币种。金额仍由 Intl 负责符号和小数位，未列出的合法代码使用通用格式。 */
export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'CNY', name: '人民币', locale: 'zh-CN' },
  { code: 'USD', name: '美元', locale: 'en-US' },
  { code: 'EUR', name: '欧元', locale: 'en-IE' },
  { code: 'GBP', name: '英镑', locale: 'en-GB' },
  { code: 'JPY', name: '日元', locale: 'ja-JP' },
  { code: 'HKD', name: '港币', locale: 'zh-HK' },
  { code: 'TWD', name: '新台币', locale: 'zh-TW' },
  { code: 'KRW', name: '韩元', locale: 'ko-KR' },
  { code: 'SGD', name: '新加坡元', locale: 'en-SG' },
  { code: 'AUD', name: '澳大利亚元', locale: 'en-AU' },
  { code: 'CAD', name: '加拿大元', locale: 'en-CA' },
  { code: 'CHF', name: '瑞士法郎', locale: 'de-CH' },
  { code: 'INR', name: '印度卢比', locale: 'en-IN' },
  { code: 'BRL', name: '巴西雷亚尔', locale: 'pt-BR' },
  { code: 'MXN', name: '墨西哥比索', locale: 'es-MX' },
  { code: 'AED', name: '阿联酋迪拉姆', locale: 'en-AE' },
  { code: 'SAR', name: '沙特里亚尔', locale: 'en-SA' },
  { code: 'THB', name: '泰铢', locale: 'th-TH' },
  { code: 'VND', name: '越南盾', locale: 'vi-VN' },
];

const currencyMap = new Map(CURRENCY_OPTIONS.map((item) => [item.code, item]));

export function currencyOption(code?: CurrencyCode): CurrencyOption {
  const normalized = (code || DEFAULT_CURRENCY_CODE).toUpperCase();
  return currencyMap.get(normalized) ?? { code: normalized, name: normalized, locale: 'en-US' };
}

export function currencyFractionDigits(code?: CurrencyCode): number {
  const option = currencyOption(code);
  return new Intl.NumberFormat(option.locale, {
    style: 'currency',
    currency: option.code,
  }).resolvedOptions().maximumFractionDigits ?? 2;
}

/** 元 → 分（四舍五入，避免浮点误差） */
export function yuanToCents(yuan: number): Money {
  return Math.round(yuan * 100);
}

/** 分 → 元 */
export function centsToYuan(cents: Money): number {
  return cents / 100;
}

/** 输入当前币种的主单位，转成该币种最小单位。保留旧 yuanToCents 作为 CNY 兼容别名。 */
export function majorToMinor(value: number, currencyCode = DEFAULT_CURRENCY_CODE): Money {
  return Math.round(value * (10 ** currencyFractionDigits(currencyCode)));
}

export function maximumMajorAmount(currencyCode = DEFAULT_CURRENCY_CODE): number {
  return MAX_SAFE_MONEY / (10 ** currencyFractionDigits(currencyCode));
}

export function isValidMajorAmount(value: number, currencyCode = DEFAULT_CURRENCY_CODE): boolean {
  if (!Number.isFinite(value) || Math.abs(value) > maximumMajorAmount(currencyCode)) return false;
  return Number.isSafeInteger(majorToMinor(value, currencyCode));
}

export function minorToMajor(value: Money, currencyCode = DEFAULT_CURRENCY_CODE): number {
  return value / (10 ** currencyFractionDigits(currencyCode));
}

export function formatCompactMajor(value: number, currencyCode = DEFAULT_CURRENCY_CODE): string {
  const option = currencyOption(currencyCode);
  const locale = currentLanguage() === 'zh-Hans' ? option.locale : currentLocale();
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

interface FormatOptions {
  /** 是否显示正负号（正数加 +），默认 false */
  withSign?: boolean;
  /** 是否显示货币符号 ¥，默认 true */
  withSymbol?: boolean;
  /** Optional UI locale override, primarily useful for chart labels/tests. */
  locale?: string;
}

/** 格式化金额（输入为分），如 1234567 -> ¥12,345.67 */
export function formatMoney(
  cents: Money,
  options: FormatOptions & { currencyCode?: CurrencyCode } = {},
): string {
  const { withSign = false, withSymbol = true } = options;
  const currencyCode = currencyOption(options.currencyCode).code;
  const option = currencyOption(currencyCode);
  const fractionDigits = currencyFractionDigits(currencyCode);
  const locale = options.locale ?? (currentLanguage() === 'zh-Hans' ? option.locale : currentLocale());
  const formatter = new Intl.NumberFormat(locale, withSymbol ? {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'symbol',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  } : {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  const body = formatter.format(minorToMajor(Math.abs(cents), currencyCode));
  if (cents < 0) return `-${body}`;
  if (withSign && cents > 0) return `+${body}`;
  return body;
}
