import { useEffect, useState } from 'react';
import { Banner, Button, SideSheet, Spin, Toast } from '@douyinfe/semi-ui';
import { IconGithubLogo, IconLock } from '@douyinfe/semi-icons';
import {
  authClient,
  fetchAuthProviders,
  type AuthProvider,
  type AuthProviderAvailability,
} from '@/services/authClient';
import { useI18n } from '@/i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AuthSideSheet({ visible, onClose }: Props) {
  const { t } = useI18n();
  const [providers, setProviders] = useState<AuthProviderAvailability | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [signingIn, setSigningIn] = useState<AuthProvider | null>(null);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    setProviders(null);
    setLoadFailed(false);
    setSigningIn(null);

    fetchAuthProviders(controller.signal)
      .then(setProviders)
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadFailed(true);
      });

    return () => controller.abort();
  }, [visible]);

  const handleSocialSignIn = async (provider: AuthProvider) => {
    try {
      setSigningIn(provider);
      const origin = window.location.origin;
      const result = await authClient.signIn.social({
        provider,
        callbackURL: origin,
        newUserCallbackURL: origin,
        errorCallbackURL: `${origin}/?auth=oauth-error`,
      });
      if (result.error) {
        Toast.error(t('auth.startFailed'));
        setSigningIn(null);
      }
    } catch {
      Toast.error(t('header.networkFailed'));
      setSigningIn(null);
    }
  };

  const hasProvider = Boolean(providers?.github || providers?.google);

  return (
    <SideSheet
      title={t('auth.title')}
      visible={visible}
      onCancel={onClose}
      width="min(440px, 100vw)"
      className="product-sheet auth-sheet"
      footer={
        <div className="sheet-footer">
          <Button onClick={onClose}>{t('auth.later')}</Button>
        </div>
      }
    >
      <div className="auth-sheet__intro">
        <span className="auth-sheet__mark"><IconLock /></span>
        <div>
        <strong>{t('auth.introTitle')}</strong>
        <p>{t('auth.introDescription')}</p>
        </div>
      </div>

      <div className="auth-provider-list" aria-live="polite">
        {!providers && !loadFailed && (
          <div className="auth-provider-list__loading">
            <Spin />
            <span>{t('auth.checking')}</span>
          </div>
        )}

        {loadFailed && (
          <Banner
            type="warning"
            description={t('auth.loadFailed')}
          />
        )}

        {providers && !hasProvider && (
          <Banner
            type="info"
            description={t('auth.noProvider')}
          />
        )}

        {providers?.github && (
          <Button
            block
            size="large"
            className="auth-provider-button"
            icon={<IconGithubLogo />}
            loading={signingIn === 'github'}
            disabled={signingIn !== null && signingIn !== 'github'}
            onClick={() => handleSocialSignIn('github')}
          >
            {t('auth.github')}
          </Button>
        )}

        {providers?.google && (
          <Button
            block
            size="large"
            className="auth-provider-button"
            icon={<span className="auth-provider-button__google" aria-hidden="true">G</span>}
            loading={signingIn === 'google'}
            disabled={signingIn !== null && signingIn !== 'google'}
            onClick={() => handleSocialSignIn('google')}
          >
            {t('auth.google')}
          </Button>
        )}
      </div>

      <div className="auth-sheet__privacy">
        <strong>{t('auth.dataTitle')}</strong>
        <p>{t('auth.dataDescription')}</p>
      </div>
    </SideSheet>
  );
}
