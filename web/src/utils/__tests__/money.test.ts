import { describe, expect, it } from 'vitest';
import {
  centsToYuan,
  formatMoney,
  majorToMinor,
  minorToMajor,
  yuanToCents,
} from '@/utils/money';

describe('money', () => {
  it('元转分（四舍五入，规避浮点误差）', () => {
    expect(yuanToCents(12.34)).toBe(1234);
    expect(yuanToCents(0.1 + 0.2)).toBe(30);
    expect(yuanToCents(5.005)).toBe(501);
    expect(yuanToCents(0)).toBe(0);
  });

  it('分转元', () => {
    expect(centsToYuan(1234)).toBe(12.34);
    expect(centsToYuan(-5000)).toBe(-50);
  });

  it('格式化金额', () => {
    expect(formatMoney(1234567)).toBe('¥12,345.67');
    expect(formatMoney(-1234567)).toBe('-¥12,345.67');
    expect(formatMoney(1500000, { withSign: true })).toBe('+¥15,000.00');
    expect(formatMoney(1234, { withSymbol: false })).toBe('12.34');
    expect(formatMoney(0)).toBe('¥0.00');
  });

  it('按当前币种使用正确的最小单位和小数位', () => {
    expect(majorToMinor(12.34, 'USD')).toBe(1234);
    expect(minorToMajor(1234, 'USD')).toBe(12.34);
    expect(formatMoney(1234, { currencyCode: 'USD' })).toBe('$12.34');
    expect(majorToMinor(1234, 'JPY')).toBe(1234);
    expect(formatMoney(1234, { currencyCode: 'JPY' })).toBe('￥1,234');
    expect(formatMoney(-1234, { currencyCode: 'JPY' })).toBe('-￥1,234');
  });
});
