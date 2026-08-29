export type LanguageCode = 'zh-Hans' | 'zh-Hant' | 'en' | 'ja' | 'de' | 'es';
export type LanguagePreference = 'system' | LanguageCode;

export const LANGUAGE_STORAGE_KEY = 'balance-window:language';

export const LANGUAGE_OPTIONS: Array<{ value: LanguagePreference; label: string; nativeLabel: string }> = [
  { value: 'system', label: '跟随系统', nativeLabel: 'System default' },
  { value: 'zh-Hans', label: '简体中文', nativeLabel: '简体中文' },
  { value: 'zh-Hant', label: '繁體中文', nativeLabel: '繁體中文' },
  { value: 'en', label: 'English', nativeLabel: 'English' },
  { value: 'ja', label: '日本語', nativeLabel: '日本語' },
  { value: 'de', label: 'Deutsch', nativeLabel: 'Deutsch' },
  { value: 'es', label: 'Español', nativeLabel: 'Español' },
];

/** UI locale is intentionally separate from the financial currency locale. */
export const LANGUAGE_LOCALES: Record<LanguageCode, string> = {
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
  en: 'en-US',
  ja: 'ja-JP',
  de: 'de-DE',
  es: 'es-ES',
};

export function detectSystemLanguage(language = typeof navigator === 'undefined' ? '' : navigator.language): LanguageCode {
  const value = language.toLowerCase();
  if (value.startsWith('zh-tw') || value.startsWith('zh-hk') || value.startsWith('zh-mo') || value.includes('hant')) {
    return 'zh-Hant';
  }
  if (value.startsWith('zh')) return 'zh-Hans';
  if (value.startsWith('ja')) return 'ja';
  if (value.startsWith('de')) return 'de';
  if (value.startsWith('es')) return 'es';
  if (value.startsWith('en')) return 'en';
  return 'zh-Hans';
}

export function resolveLanguage(
  preference: LanguagePreference,
  systemLanguage = typeof navigator === 'undefined' ? '' : navigator.language,
): LanguageCode {
  return preference === 'system' ? detectSystemLanguage(systemLanguage) : preference;
}

export function readLanguagePreference(storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage): LanguagePreference {
  const value = storage?.getItem(LANGUAGE_STORAGE_KEY);
  if (value === 'system' || LANGUAGE_OPTIONS.some((option) => option.value === value && option.value !== 'system')) {
    return value as LanguagePreference;
  }
  return 'zh-Hans';
}
