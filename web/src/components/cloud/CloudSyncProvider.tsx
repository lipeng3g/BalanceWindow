import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Banner, Button, Modal, SideSheet, Toast } from '@douyinfe/semi-ui';
import { IconCloud, IconDelete, IconDownload, IconRefresh } from '@douyinfe/semi-icons';
import { authClient } from '@/services/authClient';
import {
  CloudVaultError,
  deleteCloudAccount,
  deleteCloudVault,
  getCloudVault,
  saveCloudVault,
  type CloudVaultSnapshot,
} from '@/services/cloudVault';
import {
  activateStoreScope,
  hasFinancialData,
  readScopeData,
  removeUserScope,
  replaceScopeData,
  useStore,
} from '@/store/useStore';
import type { AppData } from '@/types';
import { exportToFile, summarize } from '@/utils/backup';
import { useI18n } from '@/i18n';

export type CloudSyncStatus =
  | 'signed-out'
  | 'loading'
  | 'choice-needed'
  | 'local-only'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'conflict'
  | 'error';

interface SyncDecision {
  kind: 'migration' | 'conflict';
  local: AppData;
  remote: CloudVaultSnapshot | null;
}

interface SyncMetadata {
  cloudEnabled: boolean;
  revision: number;
  lastSyncedHash: string;
  updatedAt?: string;
}

interface CloudSyncContextValue {
  status: CloudSyncStatus;
  label: string;
  detail: string;
  revision: number;
  updatedAt?: string;
  openSettings: () => void;
  openResolution: () => void;
}

const CloudSyncContext = createContext<CloudSyncContextValue | null>(null);
const EMPTY_DATA: AppData = { version: 1, currencyCode: 'CNY', accounts: [], transactions: [], series: [], categories: [] };

export function useCloudSync(): CloudSyncContextValue {
  const value = useContext(CloudSyncContext);
  if (!value) throw new Error('useCloudSync must be used inside CloudSyncProvider');
  return value;
}

export default function CloudSyncProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const [status, setStatus] = useState<CloudSyncStatus>('loading');
  const [revision, setRevision] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string>();
  const [decision, setDecision] = useState<SyncDecision | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const generationRef = useRef(0);
  const userIdRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const cloudEnabledRef = useRef(false);
  const revisionRef = useRef(0);
  const lastSyncedHashRef = useRef('');
  const suppressRef = useRef(false);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const saveInFlightRef = useRef(false);
  const pendingSaveRef = useRef(false);

  const setMetadata = useCallback((id: string, metadata: SyncMetadata) => {
    writeMetadata(id, metadata);
    cloudEnabledRef.current = metadata.cloudEnabled;
    revisionRef.current = metadata.revision;
    lastSyncedHashRef.current = metadata.lastSyncedHash;
    setRevision(metadata.revision);
    setUpdatedAt(metadata.updatedAt);
  }, []);

  const applyCloud = useCallback(async (id: string, remote: CloudVaultSnapshot) => {
    suppressRef.current = true;
    replaceScopeData(id, remote.data);
    suppressRef.current = false;
    setMetadata(id, {
      cloudEnabled: true,
      revision: remote.revision,
      lastSyncedHash: await fingerprint(remote.data),
      updatedAt: remote.updatedAt,
    });
    setDecision(null);
    setStatus('synced');
    readyRef.current = true;
  }, [setMetadata]);

  const showConflict = useCallback((local: AppData, remote: CloudVaultSnapshot | null) => {
    readyRef.current = false;
    setDecision({ kind: 'conflict', local, remote });
    setStatus('conflict');
  }, []);

  const saveSnapshot = useCallback(async (
    id: string,
    data: AppData,
    expectedRevision: number,
  ) => {
    if (saveInFlightRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    saveInFlightRef.current = true;
    setStatus('syncing');
    try {
      const result = await saveCloudVault(data, expectedRevision);
      if (userIdRef.current !== id) return;
      setMetadata(id, {
        cloudEnabled: true,
        revision: result.revision,
        lastSyncedHash: await fingerprint(data),
        updatedAt: result.updatedAt,
      });
      setDecision(null);
      setStatus('synced');
      readyRef.current = true;
    } catch (error) {
      if (userIdRef.current !== id) return;
      if (error instanceof CloudVaultError && error.code === 'revision_conflict') {
        try {
          const latest = await getCloudVault();
          showConflict(useStore.getState().exportData(), latest.exists ? latest : null);
        } catch {
          setStatus(navigator.onLine ? 'error' : 'offline');
        }
        return;
      }
      setStatus(navigator.onLine ? 'error' : 'offline');
    } finally {
      saveInFlightRef.current = false;
      if (
        pendingSaveRef.current
        && readyRef.current
        && cloudEnabledRef.current
        && userIdRef.current === id
      ) {
        pendingSaveRef.current = false;
        const latest = useStore.getState().exportData();
        if (await fingerprint(latest) !== lastSyncedHashRef.current) {
          void saveSnapshot(id, latest, revisionRef.current);
        }
      }
    }
  }, [setMetadata, showConflict]);

  useEffect(() => {
    if (sessionPending) return;
    const generation = ++generationRef.current;
    readyRef.current = false;
    userIdRef.current = userId;
    cloudEnabledRef.current = false;
    setDecision(null);
    window.clearTimeout(saveTimerRef.current);

    if (!userId) {
      suppressRef.current = true;
      activateStoreScope(null);
      suppressRef.current = false;
      revisionRef.current = 0;
      lastSyncedHashRef.current = '';
      setRevision(0);
      setUpdatedAt(undefined);
      setStatus('signed-out');
      return;
    }

    setStatus('loading');
    const controller = new AbortController();
    const bootstrap = async () => {
      try {
        const remoteResult = await getCloudVault(controller.signal);
        if (generationRef.current !== generation) return;
        const remote = remoteResult.exists ? remoteResult : null;
        const local = readScopeData(userId);
        const guest = readScopeData(null);
        const metadata = readMetadata(userId);

        if (!local) {
          if (hasFinancialData(guest)) {
            setDecision({ kind: 'migration', local: guest!, remote });
            setStatus('choice-needed');
            return;
          }
          if (remote) {
            await applyCloud(userId, remote);
            return;
          }
          suppressRef.current = true;
          replaceScopeData(userId, EMPTY_DATA);
          suppressRef.current = false;
          cloudEnabledRef.current = true;
          revisionRef.current = 0;
          readyRef.current = true;
          await saveSnapshot(userId, EMPTY_DATA, 0);
          return;
        }

        suppressRef.current = true;
        activateStoreScope(userId, local);
        suppressRef.current = false;

        if (metadata?.cloudEnabled === false) {
          setMetadata(userId, metadata);
          readyRef.current = true;
          setStatus('local-only');
          return;
        }

        if (!remote) {
          if (metadata && metadata.revision > 0) {
            showConflict(local, null);
            return;
          }
          cloudEnabledRef.current = true;
          revisionRef.current = 0;
          readyRef.current = true;
          await saveSnapshot(userId, local, 0);
          return;
        }

        const localHash = await fingerprint(local);
        const remoteHash = await fingerprint(remote.data);
        if (localHash === remoteHash) {
          setMetadata(userId, {
            cloudEnabled: true,
            revision: remote.revision,
            lastSyncedHash: remoteHash,
            updatedAt: remote.updatedAt,
          });
          readyRef.current = true;
          setStatus('synced');
          return;
        }

        if (!metadata) {
          showConflict(local, remote);
          return;
        }
        if (localHash === metadata.lastSyncedHash) {
          await applyCloud(userId, remote);
          return;
        }
        if (remoteHash === metadata.lastSyncedHash) {
          setMetadata(userId, { ...metadata, revision: remote.revision, updatedAt: remote.updatedAt });
          readyRef.current = true;
          await saveSnapshot(userId, local, remote.revision);
          return;
        }
        showConflict(local, remote);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (readScopeData(userId)) {
          suppressRef.current = true;
          activateStoreScope(userId);
          suppressRef.current = false;
        }
        setStatus(navigator.onLine ? 'error' : 'offline');
      }
    };

    void bootstrap();
    return () => controller.abort();
  }, [applyCloud, retryVersion, saveSnapshot, sessionPending, setMetadata, showConflict, userId]);

  useEffect(() => useStore.subscribe(() => {
    if (
      suppressRef.current
      || !readyRef.current
      || !cloudEnabledRef.current
      || !userIdRef.current
      || decision
    ) return;
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const id = userIdRef.current;
      const data = useStore.getState().exportData();
      if (id) void fingerprint(data).then((hash) => {
        if (hash === lastSyncedHashRef.current) return;
        setStatus('syncing');
        return saveSnapshot(id, data, revisionRef.current);
      });
    }, 1_500);
  }), [decision, saveSnapshot]);

  useEffect(() => {
    const retryWhenOnline = () => {
      if (userIdRef.current && cloudEnabledRef.current) setRetryVersion((value) => value + 1);
    };
    window.addEventListener('online', retryWhenOnline);
    return () => window.removeEventListener('online', retryWhenOnline);
  }, []);

  const chooseLocal = useCallback(async () => {
    if (!decision || !userIdRef.current) return;
    const id = userIdRef.current;
    const local = decision.local;
    suppressRef.current = true;
    replaceScopeData(id, local);
    suppressRef.current = false;
    const expectedRevision = decision.remote?.revision ?? 0;
    setDecision(null);
    cloudEnabledRef.current = true;
    revisionRef.current = expectedRevision;
    readyRef.current = true;
    await saveSnapshot(id, local, expectedRevision);
  }, [decision, saveSnapshot]);

  const chooseCloud = useCallback(() => {
    if (!decision?.remote || !userIdRef.current) return;
    void applyCloud(userIdRef.current, decision.remote);
  }, [applyCloud, decision]);

  const keepLocalOnly = useCallback(async () => {
    if (!decision || !userIdRef.current) return;
    const id = userIdRef.current;
    suppressRef.current = true;
    replaceScopeData(id, decision.local);
    suppressRef.current = false;
    const metadata: SyncMetadata = {
      cloudEnabled: false,
      revision: decision.remote?.revision ?? 0,
      lastSyncedHash: await fingerprint(decision.local),
      updatedAt: decision.remote?.updatedAt,
    };
    setMetadata(id, metadata);
    setDecision(null);
    readyRef.current = true;
    setStatus('local-only');
  }, [decision, setMetadata]);

  const exportDecisionData = useCallback(() => {
    if (!decision) return;
    exportToFile(decision.local, 'balance-window-local-backup.json');
    if (decision.remote) {
      window.setTimeout(() => exportToFile(decision.remote!.data, 'balance-window-cloud-backup.json'), 200);
    }
  }, [decision]);

  const enableCloud = useCallback(async () => {
    const id = userIdRef.current;
    if (!id) return;
    setSettingsVisible(false);
    setStatus('loading');
    try {
      const remoteResult = await getCloudVault();
      const local = useStore.getState().exportData();
      if (
        remoteResult.exists
        && await fingerprint(remoteResult.data) !== await fingerprint(local)
      ) {
        showConflict(local, remoteResult);
        return;
      }
      cloudEnabledRef.current = true;
      revisionRef.current = remoteResult.exists ? remoteResult.revision : 0;
      readyRef.current = true;
      await saveSnapshot(id, local, revisionRef.current);
    } catch {
      setStatus(navigator.onLine ? 'error' : 'offline');
    }
  }, [saveSnapshot, showConflict]);

  const removeCloudData = useCallback(async () => {
    const id = userIdRef.current;
    if (!id) return;
    await deleteCloudVault();
    const local = useStore.getState().exportData();
    setMetadata(id, {
      cloudEnabled: false,
      revision: 0,
      lastSyncedHash: await fingerprint(local),
    });
    readyRef.current = true;
    setStatus('local-only');
    Toast.success(t('cloud.deleted'));
  }, [setMetadata, t]);

  const removeAccount = useCallback(async () => {
    const id = userIdRef.current;
    if (!id) return;
    await deleteCloudAccount();
    removeUserScope(id);
    removeMetadata(id);
    suppressRef.current = true;
    activateStoreScope(null);
    suppressRef.current = false;
    window.location.reload();
  }, []);

  const label = statusLabel(status, t);
  const detail = statusDetail(status, updatedAt, t);
  const contextValue = useMemo<CloudSyncContextValue>(() => ({
    status,
    label,
    detail,
    revision,
    updatedAt,
    openSettings: () => setSettingsVisible(true),
    openResolution: () => {
      if (decision) return;
      setSettingsVisible(true);
    },
  }), [decision, detail, label, revision, status, updatedAt]);

  return (
    <CloudSyncContext.Provider value={contextValue}>
      {children}
      <Modal
        visible={decision !== null}
        title={decision?.kind === 'conflict' ? t('cloud.choiceTitle') : t('cloud.firstChoiceTitle')}
        closable={false}
        maskClosable={false}
        width={620}
        footer={decision ? (
          <div className={`modal-footer cloud-decision__footer${decision.remote ? ' has-remote' : ''}`}>
            <div className="cloud-decision__footer-tools">
              <Button icon={<IconDownload />} onClick={exportDecisionData}>{t('cloud.exportBoth')}</Button>
              <span>
                {decision.remote ? t('cloud.choiceHint') : t('cloud.localBackupHint')}
              </span>
            </div>
            <div className="cloud-decision__footer-actions">
              <Button onClick={() => void keepLocalOnly()}>{t('cloud.keepLocal')}</Button>
              {decision.remote && <Button onClick={chooseCloud}>{t('cloud.useCloud')}</Button>}
              <Button theme="solid" onClick={() => void chooseLocal()}>
                {decision.remote ? t('cloud.overwrite') : t('cloud.upload')}
              </Button>
            </div>
          </div>
        ) : null}
        className="cloud-decision-modal"
      >
        {decision && (
          <div className="cloud-decision">
            <Banner
              type="warning"
              description={t('cloud.choiceDescription')}
            />
            <div className="cloud-version-grid">
              <DataVersionCard title={t('cloud.localVersion')} data={decision.local} />
              <DataVersionCard
                title={t('cloud.remoteVersion')}
                data={decision.remote?.data ?? null}
                updatedAt={decision.remote?.updatedAt}
              />
            </div>
          </div>
        )}
      </Modal>

      <SideSheet
        title={t('cloud.settingsTitle')}
        visible={settingsVisible}
        onCancel={() => setSettingsVisible(false)}
        width="min(460px, 100vw)"
        className="product-sheet cloud-settings-sheet"
        footer={<div className="sheet-footer"><Button onClick={() => setSettingsVisible(false)}>{t('cloud.done')}</Button></div>}
      >
        <div className={`cloud-status-card is-${status}`}>
          <span className="cloud-status-card__icon"><IconCloud /></span>
          <div><strong>{label}</strong><p>{detail}</p></div>
        </div>
        <div className="cloud-settings-list">
          <div><span>{t('cloud.remoteRevision')}</span><strong>{revision ? `r${revision}` : t('cloud.notCreated')}</strong></div>
          <div><span>{t('cloud.lastSync')}</span><strong>{updatedAt ? formatTime(updatedAt) : '—'}</strong></div>
          <div><span>{t('cloud.localData')}</span><strong>{t('cloud.alwaysKept')}</strong></div>
          <div><span>{t('cloud.encryption')}</span><strong>AES-256-GCM</strong></div>
        </div>
        <div className="cloud-settings-actions">
          {!userId ? (
            <Banner type="info" description={t('cloud.loginHint')} />
          ) : (
            <>
              {(status === 'local-only' || status === 'error' || status === 'offline') && (
                <Button block theme="solid" icon={<IconRefresh />} onClick={() => void enableCloud()}>
                  {status === 'local-only' ? t('cloud.enable') : t('cloud.reconnect')}
                </Button>
              )}
              <Button
                block
                disabled={!revision}
                onClick={() => Modal.confirm({
                  title: t('cloud.deleteTitle'),
                  content: t('cloud.deleteContent'),
                  okText: t('cloud.delete'),
                  cancelText: t('cloud.cancel'),
                  okButtonProps: { type: 'danger' },
                  onOk: removeCloudData,
                })}
              >
                {t('cloud.delete')}
              </Button>
              <Button
                block
                type="danger"
                icon={<IconDelete />}
                onClick={() => Modal.confirm({
                  title: t('cloud.deleteAccountTitle'),
                  content: t('cloud.deleteAccountContent'),
                  okText: t('cloud.deleteAccount'),
                  cancelText: t('cloud.cancel'),
                  okButtonProps: { type: 'danger' },
                  onOk: removeAccount,
                })}
              >
                {t('cloud.deleteAccount')}
              </Button>
            </>
          )}
        </div>
      </SideSheet>
    </CloudSyncContext.Provider>
  );
}

function DataVersionCard({ title, data, updatedAt }: { title: string; data: AppData | null; updatedAt?: string }) {
  const { t } = useI18n();
  const summary = data ? summarize(data) : null;
  return (
    <div className="cloud-version-card">
      <strong>{title}</strong>
      {summary ? (
        <>
          <span>{t('cloud.accountCount', { count: summary.accounts })}</span>
          <span>{t('cloud.transactionCount', { count: summary.transactions })}</span>
          <small>{updatedAt ? t('cloud.updatedAt', { time: formatTime(updatedAt) }) : t('cloud.browserData')}</small>
        </>
      ) : <span className="cloud-version-card__empty">{t('cloud.noRemoteData')}</span>}
    </div>
  );
}

async function fingerprint(data: AppData): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function metadataKey(userId: string): string {
  return `balance-window:sync:${encodeURIComponent(userId)}`;
}

function readMetadata(userId: string): SyncMetadata | null {
  try {
    const raw = window.localStorage.getItem(metadataKey(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SyncMetadata>;
    if (
      typeof value.cloudEnabled !== 'boolean'
      || !Number.isSafeInteger(value.revision)
      || typeof value.lastSyncedHash !== 'string'
    ) return null;
    return value as SyncMetadata;
  } catch {
    return null;
  }
}

function writeMetadata(userId: string, metadata: SyncMetadata): void {
  window.localStorage.setItem(metadataKey(userId), JSON.stringify(metadata));
}

function removeMetadata(userId: string): void {
  window.localStorage.removeItem(metadataKey(userId));
}

function statusLabel(status: CloudSyncStatus, t: (key: string, values?: Record<string, string | number>) => string): string {
  return {
    'signed-out': t('cloud.statusSignedOut'),
    loading: t('cloud.statusLoading'),
    'choice-needed': t('cloud.statusChoice'),
    'local-only': t('cloud.statusLocalOnly'),
    syncing: t('cloud.statusSyncing'),
    synced: t('cloud.statusSynced'),
    offline: t('cloud.statusOffline'),
    conflict: t('cloud.statusConflict'),
    error: t('cloud.statusError'),
  }[status];
}

function statusDetail(status: CloudSyncStatus, updatedAt: string | undefined, t: (key: string, values?: Record<string, string | number>) => string): string {
  if (status === 'synced' && updatedAt) return t('cloud.detailSyncedAt', { time: formatTime(updatedAt) });
  return {
    'signed-out': t('cloud.detailSignedOut'),
    loading: t('cloud.detailLoading'),
    'choice-needed': t('cloud.detailChoice'),
    'local-only': t('cloud.detailLocalOnly'),
    syncing: t('cloud.detailSyncing'),
    synced: t('cloud.detailSynced'),
    offline: t('cloud.detailOffline'),
    conflict: t('cloud.detailConflict'),
    error: t('cloud.detailError'),
  }[status];
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(date);
}
