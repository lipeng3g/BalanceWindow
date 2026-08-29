import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppData } from '@/types';

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; name: string; email: string } },
  getCloudVault: vi.fn(),
  saveCloudVault: vi.fn(),
  deleteCloudVault: vi.fn(),
  deleteCloudAccount: vi.fn(),
}));

vi.mock('lottie-web', () => ({
  default: { loadAnimation: vi.fn() },
}));

vi.mock('@/services/authClient', () => ({
  authClient: {
    useSession: () => ({ data: mocks.session, isPending: false }),
  },
}));

vi.mock('@/services/cloudVault', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/cloudVault')>();
  return {
    ...original,
    getCloudVault: mocks.getCloudVault,
    saveCloudVault: mocks.saveCloudVault,
    deleteCloudVault: mocks.deleteCloudVault,
    deleteCloudAccount: mocks.deleteCloudAccount,
  };
});

import CloudSyncProvider, { useCloudSync } from '../CloudSyncProvider';
import { activateStoreScope, replaceScopeData, useStore, userPersistKey } from '@/store/useStore';

const localData: AppData = {
  version: 1,
  currencyCode: 'CNY',
  accounts: [{
    id: 'local-account', name: '本机账户', openingBalance: 10_000, openingDate: '2026-01-01',
    color: '#1677ff', archived: false, createdAt: 1, updatedAt: 1,
  }],
  transactions: [],
  series: [],
  categories: [],
};

const remoteData: AppData = {
  ...localData,
  accounts: [{ ...localData.accounts[0], id: 'cloud-account', name: '云端账户' }],
};

function Probe() {
  const sync = useCloudSync();
  return <button onClick={sync.openSettings}>{sync.label}</button>;
}

describe('CloudSyncProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.session = { user: { id: 'user-1', name: '测试用户', email: 'test@example.com' } };
    mocks.getCloudVault.mockReset();
    mocks.saveCloudVault.mockReset();
    mocks.deleteCloudVault.mockReset();
    mocks.deleteCloudAccount.mockReset();
    activateStoreScope(null, localData);
  });

  it('首次登录先展示本机数据，不自动上传', async () => {
    mocks.getCloudVault.mockResolvedValue({ exists: false });
    mocks.saveCloudVault.mockResolvedValue({ revision: 1, updatedAt: '2026-07-23T08:00:00.000Z' });

    render(<CloudSyncProvider><Probe /></CloudSyncProvider>);

    expect(await screen.findByText('选择首次登录的数据')).toBeInTheDocument();
    expect(screen.getByText('1 个账户')).toBeInTheDocument();
    expect(mocks.saveCloudVault).not.toHaveBeenCalled();

    const uploadButton = screen.getByRole('button', { name: '上传本机数据' });
    expect(uploadButton.closest('.semi-modal-footer')).not.toBeNull();
    expect(uploadButton.closest('.semi-modal-body')).toBeNull();

    fireEvent.click(uploadButton);
    await waitFor(() => expect(mocks.saveCloudVault).toHaveBeenCalledWith(localData, 0));
    expect(await screen.findByRole('button', { name: '云端已同步' })).toBeInTheDocument();
    expect(window.localStorage.getItem(userPersistKey('user-1'))).toContain('local-account');
  });

  it('两边都改过时进入冲突，不做静默覆盖', async () => {
    replaceScopeData('user-1', localData);
    window.localStorage.setItem('balance-window:sync:user-1', JSON.stringify({
      cloudEnabled: true,
      revision: 1,
      lastSyncedHash: JSON.stringify({ ...localData, accounts: [] }),
    }));
    mocks.getCloudVault.mockResolvedValue({
      exists: true,
      revision: 2,
      schemaVersion: 1,
      updatedAt: '2026-07-23T08:00:00.000Z',
      data: remoteData,
    });

    render(<CloudSyncProvider><Probe /></CloudSyncProvider>);

    expect(await screen.findByText('发现两份不同的资金数据')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '使用云端数据' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '用本机数据覆盖云端' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暂时仅保存在本机' })).toBeInTheDocument();
    expect(mocks.saveCloudVault).not.toHaveBeenCalled();
    expect(useStore.getState().accounts[0].id).toBe('local-account');

    const footer = screen.getByText('分别导出备份').closest('.cloud-decision__footer');
    expect(footer).not.toBeNull();
    expect(footer).toHaveClass('has-remote');
    expect(footer?.querySelector('.cloud-decision__footer-tools')).not.toBeNull();
    expect(footer?.querySelector('.cloud-decision__footer-actions')).not.toBeNull();
    expect(footer?.querySelectorAll('.cloud-decision__footer-actions .semi-button')).toHaveLength(3);
  });
});
