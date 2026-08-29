export const FREE_ACCOUNT_LIMIT = 2;

export interface Entitlements {
  plan: 'free' | 'subscriber';
  maxAccounts: number | null;
  aiEnabled: boolean;
  widgetsEnabled: boolean;
}

export function getFreeEntitlements(): Entitlements {
  return {
    plan: 'free',
    maxAccounts: FREE_ACCOUNT_LIMIT,
    aiEnabled: false,
    widgetsEnabled: false,
  };
}
