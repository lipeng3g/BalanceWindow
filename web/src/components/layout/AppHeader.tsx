import { useRef, useState, type ChangeEvent } from 'react';
import { Button, Dropdown, Modal, Select, Toast, Tooltip } from '@douyinfe/semi-ui';
import {
  IconApps,
  IconCloud,
  IconDelete,
  IconExport,
  IconGithubLogo,
  IconHelpCircle,
  IconImport,
  IconMoon,
  IconPlus,
  IconRestart,
  IconSetting,
  IconSun,
  IconUser,
} from '@douyinfe/semi-icons';
import type { Account, AppData } from '@/types';
import type { ImportMode } from '@/store/types';
import { GITHUB_URL } from '@/config/product';
import { useTheme } from '@/hooks/useTheme';
import { useStore } from '@/store/useStore';
import { exportToFile, importFromFile } from '@/utils/backup';
import { CURRENCY_OPTIONS, currencyOption } from '@/utils/money';
import { today } from '@/utils/date';
import ImportConfirmModal from './ImportConfirmModal';
import AuthSideSheet from '@/components/auth/AuthSideSheet';
import { authClient } from '@/services/authClient';
import { useCloudSync } from '@/components/cloud/CloudSyncProvider';
import { LANGUAGE_OPTIONS, useI18n, type LanguagePreference } from '@/i18n';

interface Props {
  onManageCategories: () => void;
  onOpenGuide: () => void;
  accountCount: number;
  focusedAccount?: Pick<Account, 'name' | 'color'> | null;
  onClearAccountFocus?: () => void;
  onPrimaryAction: () => void;
}

export default function AppHeader({
  onManageCategories,
  onOpenGuide,
  accountCount,
  focusedAccount,
  onClearAccountFocus,
  onPrimaryAction,
}: Props) {
  const { t, preference, setPreference, languageLabel } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const exportData = useStore((s) => s.exportData);
  const importData = useStore((s) => s.importData);
  const resetAll = useStore((s) => s.resetAll);
  const loadSeed = useStore((s) => s.loadSeed);
  const currencyCode = useStore((s) => s.currencyCode);
  const setCurrencyCode = useStore((s) => s.setCurrencyCode);
  const hasFinancialData = useStore((s) => s.accounts.length > 0 || s.transactions.length > 0 || s.series.length > 0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<AppData | null>(null);
  const [authVisible, setAuthVisible] = useState(false);
  const [currencyVisible, setCurrencyVisible] = useState(false);
  const [currencyDraft, setCurrencyDraft] = useState(currencyCode);
  const [languageVisible, setLanguageVisible] = useState(false);
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const cloudSync = useCloudSync();

  const handleExport = () => {
    const data = exportData();
    if (!data.accounts.length && !data.transactions.length) {
      Toast.info(t('header.noExportData'));
      return;
    }
    exportToFile(data, `balance-window-${today().replace(/-/g, '')}.json`);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setPending(await importFromFile(file));
    } catch {
      Toast.error(t('header.importFailed'));
    }
  };

  const handleConfirmImport = (mode: ImportMode) => {
    if (!pending) return;
    const incomingHasFinancialData = pending.accounts.length > 0
      || pending.transactions.length > 0
      || pending.series.length > 0;
    if (
      mode === 'merge'
      && hasFinancialData
      && incomingHasFinancialData
      && (pending.currencyCode ?? 'CNY') !== currencyCode
    ) {
      Toast.error(t('header.importCurrencyMismatch'));
      return;
    }
    importData(pending, mode);
    Toast.success(
      t('header.imported', {
        mode: mode === 'merge' ? t('header.merged') : t('header.replaced'),
        accounts: pending.accounts.length,
        transactions: pending.transactions.length,
      }),
    );
    setPending(null);
  };

  const openCurrencySettings = () => {
    setCurrencyDraft(currencyCode);
    setCurrencyVisible(true);
  };

  const saveCurrency = () => {
    const next = currencyOption(currencyDraft).code;
    if (next === currencyCode) {
      setCurrencyVisible(false);
      return;
    }
    const apply = () => {
      setCurrencyCode(next);
      setCurrencyVisible(false);
      Toast.success(t('header.currencyChanged', { code: next }));
    };
    if (!hasFinancialData) {
      apply();
      return;
    }
    Modal.confirm({
      title: t('header.currencyConfirmTitle'),
      content: t('header.currencyConfirm', { code: next }),
      okText: t('header.confirmSwitch'),
      cancelText: t('common.cancel'),
      onOk: apply,
    });
  };

  const confirmLoadSeed = () =>
    Modal.confirm({
      title: t('header.seedTitle'),
      content: t('header.seedConfirm'),
      okText: t('header.seed'),
      cancelText: t('common.cancel'),
      onOk: () => {
        loadSeed();
        Toast.success(t('header.seedLoaded'));
      },
    });

  const confirmResetAll = () =>
    Modal.confirm({
      title: t('header.resetTitle'),
      content: t('header.resetConfirm'),
      okText: t('header.reset'),
      cancelText: t('common.cancel'),
      okButtonProps: { type: 'danger' },
      onOk: () => {
        resetAll();
        Toast.success(t('header.resetDone'));
      },
    });

  const dataMenu = (
    <Dropdown.Menu>
      <Dropdown.Item icon={<IconExport />} onClick={handleExport}>
        {t('header.export')}
      </Dropdown.Item>
      <Dropdown.Item icon={<IconImport />} onClick={() => fileRef.current?.click()}>
        {t('header.import')}
      </Dropdown.Item>
      <Dropdown.Item icon={<IconRestart />} onClick={confirmLoadSeed}>
        {t('header.seed')}
      </Dropdown.Item>
      <Dropdown.Item icon={<IconDelete />} type="danger" onClick={confirmResetAll}>
        {t('header.reset')}
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item icon={<IconSetting />} onClick={openCurrencySettings}>
        {t('header.currency', { code: currencyCode })}
      </Dropdown.Item>
      <Dropdown.Item icon={<IconSetting />} onClick={() => setLanguageVisible(true)}>
        {t('header.language', { language: languageLabel })}
      </Dropdown.Item>
    </Dropdown.Menu>
  );

  const userMenu = session ? (
    <Dropdown.Menu>
      <Dropdown.Title>{session.user.name || session.user.email}</Dropdown.Title>
      <Dropdown.Item disabled>{session.user.email}</Dropdown.Item>
      <Dropdown.Item icon={<IconCloud />} onClick={cloudSync.openSettings}>
        {t('header.cloud')}
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item
        onClick={async () => {
          try {
            const result = await authClient.signOut();
            if (result.error) {
              Toast.error(t('header.signOutFailed'));
              return;
            }
            Toast.success(t('header.signedOut'));
          } catch {
            Toast.error(t('header.networkFailed'));
          }
        }}
      >
        {t('header.signOut')}
      </Dropdown.Item>
    </Dropdown.Menu>
  ) : null;

  return (
    <header className="app-header">
      <div className="app-header__left">
        <div className="mobile-brand" aria-label={`Balance Window ${t('main.chart')}`}>
          <span className="brand__logo">BW</span>
          <span className="brand__copy">
            <span className="brand__name">Balance Window</span>
          </span>
        </div>

        <div className="page-context">
          <span
            className={`page-context__avatar${focusedAccount ? '' : ' page-context__avatar--all'}`}
            style={focusedAccount ? { background: focusedAccount.color } : undefined}
            aria-hidden="true"
          >
            {focusedAccount
              ? focusedAccount.name.trim().slice(0, 1) || t('accounts.title').slice(0, 1)
              : accountCount ? t('accounts.all').slice(0, 1) : <IconPlus />}
          </span>
          <span className="page-context__copy">
            <span className="page-context__title">
              {focusedAccount?.name ?? (accountCount ? t('header.allAccounts') : t('header.noAccounts'))}
            </span>
            <span className="page-context__subtitle">
              {focusedAccount
                ? t('header.singleAccount')
                : accountCount
                  ? t('header.accountSummary', { count: accountCount })
                  : t('header.startAccount')}
            </span>
          </span>
          {focusedAccount && onClearAccountFocus && (
            <Button
              size="small"
              theme="borderless"
              type="tertiary"
              onClick={onClearAccountFocus}
            >
              {t('header.viewAll')}
            </Button>
          )}
        </div>
      </div>

      <div className="header-actions">
        <Button
          className="header-primary-action"
          theme="solid"
          icon={<IconPlus />}
          onClick={onPrimaryAction}
          aria-label={accountCount ? t('header.addTransaction') : t('header.newAccount')}
        >
          {accountCount ? t('header.addTransaction') : t('header.newAccount')}
        </Button>

        <Button
          className="header-action header-action--categories"
          theme="borderless"
          type="tertiary"
          icon={<IconApps />}
          onClick={onManageCategories}
          aria-label={t('header.categories')}
        >
          {t('header.categories')}
        </Button>

        <Tooltip content={t('header.help')}>
          <Button
            className="header-icon-action"
            theme="borderless"
            type="tertiary"
            icon={<IconHelpCircle />}
            onClick={onOpenGuide}
            aria-label={t('header.help')}
          />
        </Tooltip>

        <Tooltip content={t('header.github')}>
          <Button
            className="header-icon-action header-github-action"
            theme="borderless"
            type="tertiary"
            icon={<IconGithubLogo />}
            onClick={() => window.open(GITHUB_URL, '_blank', 'noopener,noreferrer')}
            aria-label={t('header.github')}
          />
        </Tooltip>

        <Tooltip content={theme === 'dark' ? t('header.lightTheme') : t('header.darkTheme')}>
          <Button
            className="header-icon-action"
            theme="borderless"
            type="tertiary"
            icon={theme === 'dark' ? <IconSun /> : <IconMoon />}
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t('header.lightTheme') : t('header.darkTheme')}
          />
        </Tooltip>

        {session ? (
          <>
            <Tooltip content={cloudSync.detail}>
              <Button
                className={`header-sync-status is-${cloudSync.status}`}
                theme="borderless"
                type={cloudSync.status === 'conflict' || cloudSync.status === 'error' ? 'danger' : 'tertiary'}
                icon={<IconCloud />}
                onClick={cloudSync.status === 'conflict' ? cloudSync.openResolution : cloudSync.openSettings}
              >
                {cloudSync.label}
              </Button>
            </Tooltip>
            <Dropdown trigger="click" position="bottomRight" render={userMenu}>
              <Button
                className="header-action header-action--auth"
                icon={<IconUser />}
                aria-label={t('header.user')}
              >
                {session.user.name || session.user.email.split('@')[0]}
              </Button>
            </Dropdown>
          </>
        ) : (
          <Button
            className="header-action header-action--auth"
            theme="borderless"
            type="tertiary"
            icon={<IconUser />}
            loading={sessionPending}
            onClick={() => setAuthVisible(true)}
          >
            {t('header.login')}
          </Button>
        )}

        <Dropdown trigger="click" position="bottomRight" render={dataMenu}>
          <Button
            className="header-action header-action--settings"
            icon={<IconSetting />}
            aria-label={t('header.dataSettings')}
          >
            {t('header.dataSettings')}
          </Button>
        </Dropdown>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={handleFileChange}
      />
      <ImportConfirmModal
        data={pending}
        onConfirm={handleConfirmImport}
        onClose={() => setPending(null)}
      />
      <AuthSideSheet visible={authVisible} onClose={() => setAuthVisible(false)} />
      <Modal
        visible={currencyVisible}
        title={t('header.currencyTitle')}
        onCancel={() => setCurrencyVisible(false)}
        onOk={saveCurrency}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
      >
        <p className="form-hint">{t('header.currencyHint')}</p>
        <Select
          value={currencyDraft}
          onChange={(value) => setCurrencyDraft(String(value))}
          style={{ width: '100%' }}
          optionList={CURRENCY_OPTIONS.map((item) => ({
            value: item.code,
            label: `${t(`currency.${item.code}`)}（${item.code}）`,
          }))}
        />
      </Modal>
      <Modal
        visible={languageVisible}
        title={t('settings.language')}
        onCancel={() => setLanguageVisible(false)}
        onOk={() => setLanguageVisible(false)}
        okText={t('common.done')}
        cancelText={t('common.cancel')}
      >
        <p className="form-hint">{t('settings.languageHint')}</p>
        <Select
          value={preference}
          onChange={(value) => setPreference(String(value) as LanguagePreference)}
          style={{ width: '100%' }}
          optionList={LANGUAGE_OPTIONS.map((item) => ({
            value: item.value,
            label: item.value === 'system' ? t('settings.followSystem') : item.nativeLabel,
          }))}
        />
      </Modal>
    </header>
  );
}
