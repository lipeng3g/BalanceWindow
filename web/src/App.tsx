import { Suspense, lazy, useEffect, useState } from 'react';
import { Button, Spin, Toast, Tooltip } from '@douyinfe/semi-ui';
import {
  IconBulb,
  IconChevronLeft,
  IconChevronRight,
  IconGithubLogo,
  IconLock,
} from '@douyinfe/semi-icons';
import AppHeader from '@/components/layout/AppHeader';
import ProductGuideSideSheet from '@/components/layout/ProductGuideSideSheet';
import AccountFormModal from '@/components/accounts/AccountFormModal';
import AccountPanel from '@/components/accounts/AccountPanel';
import CategoryManager from '@/components/categories/CategoryManager';
import ChartToolbar from '@/components/charts/ChartToolbar';
import LedgerTable from '@/components/charts/LedgerTable';
import OverviewStats from '@/components/charts/OverviewStats';
import EmptyState from '@/components/common/EmptyState';
import DayDetailModal from '@/components/transactions/DayDetailModal';
import TransactionFormModal from '@/components/transactions/TransactionFormModal';
import {
  COPYRIGHT_YEAR,
  GITHUB_URL,
  GUIDE_PREFERENCE_KEY,
  PRODUCT_NAME,
  PRODUCT_VERSION,
  SIDEBAR_PREFERENCE_KEY,
} from '@/config/product';
import { useStore } from '@/store/useStore';
import { useCloudSync } from '@/components/cloud/CloudSyncProvider';
import { useI18n } from '@/i18n';

// VChart 体积较大，按需加载以加快首屏
const BalanceChart = lazy(() => import('@/components/charts/BalanceChart'));

export default function App() {
  const { t } = useI18n();
  const cloudSync = useCloudSync();
  const [categoryVisible, setCategoryVisible] = useState(false);
  const [dayDate, setDayDate] = useState<string | null>(null);
  const [focusedAccountId, setFocusedAccountId] = useState<string | null>(null);
  const [guideVisible, setGuideVisible] = useState(false);
  const [headerTransactionVisible, setHeaderTransactionVisible] = useState(false);
  const [headerAccountVisible, setHeaderAccountVisible] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === '1',
  );
  const hasAccounts = useStore((s) => s.accounts.length > 0);
  const loadSeed = useStore((s) => s.loadSeed);
  const accounts = useStore((s) => s.accounts);
  const focusedAccount = focusedAccountId
    ? accounts.find((a) => a.id === focusedAccountId) ?? null
    : null;

  useEffect(() => {
    if (window.localStorage.getItem(GUIDE_PREFERENCE_KEY) !== '1') {
      setGuideVisible(true);
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('auth') !== 'oauth-error') return;

    const errorCode = url.searchParams.get('error');
    const message = t(`auth.oauthError.${errorCode ?? 'default'}`);
    Toast.error(message);
    url.searchParams.delete('auth');
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [t]);

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, next ? '1' : '0');
      return next;
    });
  };

  const closeGuide = () => {
    window.localStorage.setItem(GUIDE_PREFERENCE_KEY, '1');
    setGuideVisible(false);
  };

  return (
    <div className="app">
      <div className={`app-shell${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
        <AppHeader
          onManageCategories={() => setCategoryVisible(true)}
          onOpenGuide={() => setGuideVisible(true)}
          accountCount={accounts.length}
          focusedAccount={focusedAccount}
          onClearAccountFocus={() => setFocusedAccountId(null)}
          onPrimaryAction={() => {
            if (hasAccounts) setHeaderTransactionVisible(true);
            else setHeaderAccountVisible(true);
          }}
        />

        <aside className={`app-sidebar${sidebarCollapsed ? ' is-collapsed' : ''}`}>
          <div className="sidebar-brand">
            <div className="brand" aria-label={`Balance Window ${t('main.chart')}`}>
              <span className="brand__logo">BW</span>
              <span className="brand__copy">
                <span className="brand__name">Balance Window</span>
              <span className="brand__tagline">{t('main.chart')}</span>
              </span>
            </div>
          </div>

          <div className="app-sidebar__content">
            <AccountPanel
              focusedAccountId={focusedAccountId}
              onFocusAccount={setFocusedAccountId}
            />
          </div>

          <div className="app-sidebar__bottom">
            <div className="app-sidebar__footer">
              <button
                type="button"
                className={`app-sidebar__privacy is-${cloudSync.status}`}
                onClick={cloudSync.openSettings}
              >
                <IconLock /> {cloudSync.label}
              </button>
              <div>© {COPYRIGHT_YEAR} {PRODUCT_NAME} · v{PRODUCT_VERSION}</div>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">{t('header.github')}</a>
            </div>
            <Tooltip content={t('header.github')} position="right">
              <a
                className="app-sidebar__footer-compact"
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                aria-label={t('header.github')}
              >
                <IconGithubLogo />
              </a>
            </Tooltip>
            <Tooltip content={sidebarCollapsed ? t('common.expandAccountBar') : t('common.collapseAccountBar')} position="right">
              <button
                type="button"
                className="sidebar-collapse-control"
                onClick={toggleSidebar}
                aria-label={sidebarCollapsed ? t('common.expandAccountBar') : t('common.collapseAccountBar')}
              >
                {sidebarCollapsed ? <IconChevronRight /> : <IconChevronLeft />}
                <span className="sidebar-collapse-control__label">{t('common.collapseAccountBar')}</span>
              </button>
            </Tooltip>
          </div>
        </aside>

        {hasAccounts ? (
          <main className="app-main">
            <OverviewStats accountId={focusedAccountId} />
            <div className="chart-card app-card">
              <div className="app-card__head">
                <span className="zone-title">{t('main.chart')}</span>
                <span className="app-card__hint">{t('main.chartHint')}</span>
              </div>
              <ChartToolbar accountId={focusedAccountId} />
              <Suspense
                fallback={
                  <div className="chart-host chart-host--empty">
                    <Spin size="large" />
                  </div>
                }
              >
                <BalanceChart onDayClick={setDayDate} accountId={focusedAccountId} />
              </Suspense>
            </div>
            <LedgerTable accountId={focusedAccountId} />
          </main>
        ) : (
          <main className="app-main app-main--onboarding">
            <div className="onboarding">
              <EmptyState
                title={t('main.onboardingTitle')}
                description={t('main.onboardingDescription')}
                action={
                  <Button
                    theme="solid"
                    icon={<IconBulb />}
                    onClick={() => {
                      loadSeed();
                    Toast.success(t('main.seedLoaded'));
                    }}
                  >
                    {t('header.seed')}
                  </Button>
                }
              />
            </div>
          </main>
        )}
      </div>

      <CategoryManager visible={categoryVisible} onClose={() => setCategoryVisible(false)} />
      <DayDetailModal
        visible={dayDate !== null}
        date={dayDate ?? ''}
        onClose={() => setDayDate(null)}
      />
      <ProductGuideSideSheet visible={guideVisible} onClose={closeGuide} />
      <AccountFormModal
        visible={headerAccountVisible}
        account={null}
        onClose={() => setHeaderAccountVisible(false)}
      />
      <TransactionFormModal
        visible={headerTransactionVisible}
        defaultAccountId={focusedAccountId ?? undefined}
        onClose={() => setHeaderTransactionVisible(false)}
      />
    </div>
  );
}
