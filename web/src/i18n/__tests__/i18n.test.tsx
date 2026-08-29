import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider, useI18n } from '..';

function Probe() {
  const { t, setPreference, language, languageLabel } = useI18n();
  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="language-label">{languageLabel}</span>
      <span data-testid="chart">{t('main.chart')}</span>
      <span data-testid="day-detail">{t('day.balances')}</span>
      <button onClick={() => setPreference('en')}>English</button>
      <button onClick={() => setPreference('zh-Hant')}>繁體</button>
      <button onClick={() => setPreference('system')}>System</button>
    </div>
  );
}

describe('web internationalisation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'zh-CN' });
  });

  it('keeps the existing Simplified Chinese interface by default', () => {
    render(<I18nProvider><Probe /></I18nProvider>);
    expect(screen.getByTestId('language')).toHaveTextContent('zh-Hans');
    expect(screen.getByTestId('chart')).toHaveTextContent('资金走势');
  });

  it('switches immediately and persists the selected locale', () => {
    render(<I18nProvider><Probe /></I18nProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByTestId('language')).toHaveTextContent('en');
    expect(screen.getByTestId('language-label')).toHaveTextContent('English');
    expect(screen.getByTestId('chart')).toHaveTextContent('Cash-flow outlook');
    expect(window.localStorage.getItem('balance-window:language')).toBe('en');
    fireEvent.click(screen.getByRole('button', { name: '繁體' }));
    expect(screen.getByTestId('language')).toHaveTextContent('zh-Hant');
    expect(screen.getByTestId('chart')).toHaveTextContent('資金走勢');
    expect(screen.getByTestId('day-detail')).toHaveTextContent('當日各帳戶餘額');
    fireEvent.click(screen.getByRole('button', { name: 'System' }));
    expect(screen.getByTestId('language-label')).toHaveTextContent('跟随系统');
  });
});
