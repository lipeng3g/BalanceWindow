import type { StateCreator } from 'zustand';
import type { AppData } from '@/types';
import type { AccountsSlice } from './slices/accountsSlice';
import type { CategoriesSlice } from './slices/categoriesSlice';
import type { SettingsSlice } from './slices/settingsSlice';
import type { TransactionsSlice } from './slices/transactionsSlice';

/** 导入方式：覆盖现有数据，或按 id 合并 */
export type ImportMode = 'replace' | 'merge';

/** 跨 slice 的整体数据操作 */
export interface DataSlice {
  exportData: () => AppData;
  importData: (data: AppData, mode?: ImportMode) => void;
  resetAll: () => void;
  /** 用示例数据（账户/分类/收支）替换当前全部数据 */
  loadSeed: () => void;
}

export type Store = AccountsSlice &
  TransactionsSlice &
  CategoriesSlice &
  SettingsSlice &
  DataSlice;

/** 统一的 slice 创建器类型（携带 persist 中间件签名） */
export type SliceCreator<T> = StateCreator<Store, [['zustand/persist', unknown]], [], T>;
