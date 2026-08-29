import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DATA_VERSION, type AppData } from '@/types';
import { mergeAppData } from '@/utils/backup';
import { createAccountsSlice } from './slices/accountsSlice';
import { createCategoriesSlice } from './slices/categoriesSlice';
import { createSettingsSlice, initialSettings } from './slices/settingsSlice';
import { createTransactionsSlice } from './slices/transactionsSlice';
import { createSeedData } from '@/utils/seed';
import type { Store } from './types';

export const GUEST_PERSIST_KEY = 'balance-window:guest';

export const useStore = create<Store>()(
  persist(
    (...a) => {
      const [set, get] = a;
      return {
        ...createAccountsSlice(...a),
        ...createTransactionsSlice(...a),
        ...createCategoriesSlice(...a),
        ...createSettingsSlice(...a),

        exportData: (): AppData => {
          const { accounts, transactions, series, categories, currencyCode } = get();
          return { version: DATA_VERSION, currencyCode, accounts, transactions, series, categories };
        },

        importData: (data, mode = 'replace') => {
          const { accounts, transactions, series, categories, currencyCode } = get();
          const next =
            mode === 'merge'
              ? mergeAppData({ version: DATA_VERSION, currencyCode, accounts, transactions, series, categories }, data)
              : { ...data, currencyCode: data.currencyCode ?? 'CNY' };
          set({
            currencyCode: next.currencyCode ?? 'CNY',
            accounts: next.accounts,
            transactions: next.transactions,
            series: next.series,
            categories: next.categories,
          });
        },

        resetAll: () => {
          set({ accounts: [], transactions: [], series: [], categories: [], ...initialSettings });
        },

        loadSeed: () => set(createSeedData()),
      };
    },
    {
      name: GUEST_PERSIST_KEY,
      version: DATA_VERSION,
      merge: (persistedState, currentState) => {
        const saved = persistedState as Partial<Store> & { chartRangeVersion?: number };
        const migrateOldDefault =
          saved.chartRangeVersion === undefined && saved.rangePreset === 'P0M-F12M';
        return {
          ...currentState,
          ...saved,
          chartRangeVersion: initialSettings.chartRangeVersion,
          rangePreset: migrateOldDefault
            ? initialSettings.rangePreset
            : saved.rangePreset ?? currentState.rangePreset,
        };
      },
      partialize: (s) => ({
        accounts: s.accounts,
        transactions: s.transactions,
        series: s.series,
        categories: s.categories,
        currencyCode: s.currencyCode,
        theme: s.theme,
        chartRangeVersion: s.chartRangeVersion,
        rangePreset: s.rangePreset,
        customFrom: s.customFrom,
        customTo: s.customTo,
        granularity: s.granularity,
        visibleAccountIds: s.visibleAccountIds,
        showTotal: s.showTotal,
        showChartLabels: s.showChartLabels,
      }),
    },
  ),
);

if (typeof window !== 'undefined' && !window.localStorage.getItem(GUEST_PERSIST_KEY)) {
  useStore.setState(createSeedData());
}

export function userPersistKey(userId: string): string {
  return `balance-window:user:${encodeURIComponent(userId)}`;
}

export function readScopeData(userId: string | null): AppData | null {
  if (typeof window === 'undefined') return null;
  const persisted = readPersistedState(userId ? userPersistKey(userId) : GUEST_PERSIST_KEY);
  if (!persisted) return null;
  const candidate = {
    version: DATA_VERSION,
    currencyCode: persisted.currencyCode ?? 'CNY',
    accounts: persisted.accounts,
    transactions: persisted.transactions,
    series: persisted.series,
    categories: persisted.categories,
  };
  if (
    !Array.isArray(candidate.accounts)
    || !Array.isArray(candidate.transactions)
    || !Array.isArray(candidate.series)
    || !Array.isArray(candidate.categories)
  ) return null;
  return candidate as AppData;
}

export function activateStoreScope(userId: string | null, fallbackData?: AppData): AppData {
  const key = userId ? userPersistKey(userId) : GUEST_PERSIST_KEY;
  const persisted = typeof window === 'undefined' ? null : readPersistedState(key);
  const fallback = fallbackData ?? (userId ? emptyAppData() : createSeedData());
  const next = {
    ...initialSettings,
    currencyCode: fallbackData?.currencyCode ?? 'CNY',
    accounts: fallback.accounts,
    transactions: fallback.transactions,
    series: fallback.series,
    categories: fallback.categories,
    ...(persisted ?? {}),
  };

  useStore.persist.setOptions({ name: key });
  useStore.setState(next);
  return useStore.getState().exportData();
}

export function replaceScopeData(userId: string, data: AppData): AppData {
  const key = userPersistKey(userId);
  useStore.persist.setOptions({ name: key });
  useStore.setState({
    currencyCode: data.currencyCode ?? 'CNY',
    accounts: data.accounts,
    transactions: data.transactions,
    series: data.series,
    categories: data.categories,
  });
  return useStore.getState().exportData();
}

export function removeUserScope(userId: string): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(userPersistKey(userId));
}

export function hasFinancialData(data: AppData | null): boolean {
  return Boolean(data && (
    data.accounts.length
    || data.transactions.length
    || data.series.length
    || data.categories.length
  ));
}

function emptyAppData(): AppData {
  return { version: DATA_VERSION, currencyCode: 'CNY', accounts: [], transactions: [], series: [], categories: [] };
}

function readPersistedState(key: string): Partial<Store> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: unknown };
    return typeof parsed.state === 'object' && parsed.state !== null
      ? parsed.state as Partial<Store>
      : null;
  } catch {
    return null;
  }
}
