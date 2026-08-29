import type { Account, Money } from '@/types';
import { uid } from '@/utils/id';
import { nextColor } from '@/utils/palette';
import type { SliceCreator } from '../types';
import { FREE_ACCOUNT_LIMIT } from '@/config/product';
import { DATA_LIMITS } from '@/config/dataLimits';
import { assertSafeMoney, normalizedEditorName } from '@/utils/inputValidation';

export interface AccountInput {
  name: string;
  openingBalance: Money;
  openingDate: string;
  color?: string;
  categoryId?: string;
}

export const ACCOUNT_LIMIT_ERROR = 'ACCOUNT_LIMIT_REACHED';

export interface AccountsSlice {
  accounts: Account[];
  addAccount: (input: AccountInput) => string;
  updateAccount: (id: string, patch: Partial<AccountInput>) => void;
  archiveAccount: (id: string, archived: boolean) => void;
  removeAccount: (id: string) => void;
}

export const createAccountsSlice: SliceCreator<AccountsSlice> = (set, get) => ({
  accounts: [],

  addAccount: (input) => {
    if (get().accounts.length >= FREE_ACCOUNT_LIMIT) {
      throw new Error(ACCOUNT_LIMIT_ERROR);
    }
    const name = normalizedEditorName(input.name, DATA_LIMITS.accountNameInput);
    assertSafeMoney(input.openingBalance, true);
    const now = Date.now();
    const account: Account = {
      id: uid(),
      name,
      categoryId: input.categoryId,
      openingBalance: input.openingBalance,
      openingDate: input.openingDate,
      color: input.color ?? nextColor(get().accounts.length),
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ accounts: [...s.accounts, account] }));
    return account.id;
  },

  updateAccount: (id, patch) => {
    const safePatch = { ...patch };
    if (safePatch.name != null) safePatch.name = normalizedEditorName(safePatch.name, DATA_LIMITS.accountNameInput);
    if (safePatch.openingBalance != null) assertSafeMoney(safePatch.openingBalance, true);
    set((s) => ({
      accounts: s.accounts.map((a) =>
        a.id === id ? { ...a, ...safePatch, updatedAt: Date.now() } : a,
      ),
    }));
  },

  archiveAccount: (id, archived) => {
    set((s) => ({
      accounts: s.accounts.map((a) =>
        a.id === id ? { ...a, archived, updatedAt: Date.now() } : a,
      ),
    }));
  },

  removeAccount: (id) => {
    set((s) => ({
      accounts: s.accounts.filter((a) => a.id !== id),
      transactions: s.transactions.filter((t) => t.accountId !== id),
      series: s.series.filter((ser) => ser.accountId !== id),
    }));
  },
});
