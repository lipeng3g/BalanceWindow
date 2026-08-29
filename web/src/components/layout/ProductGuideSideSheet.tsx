import { Button, SideSheet } from '@douyinfe/semi-ui';
import { IconGithubLogo, IconLock } from '@douyinfe/semi-icons';
import {
  COPYRIGHT_YEAR,
  GITHUB_URL,
  PRODUCT_NAME,
  PRODUCT_VERSION,
} from '@/config/product';
import { useI18n } from '@/i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function ProductGuideSideSheet({ visible, onClose }: Props) {
  const { t } = useI18n();
  const steps = [
    { title: t('guide.step1Title'), description: t('guide.step1Description') },
    { title: t('guide.step2Title'), description: t('guide.step2Description') },
    { title: t('guide.step3Title'), description: t('guide.step3Description') },
    { title: t('guide.step4Title'), description: t('guide.step4Description') },
  ];
  return (
    <SideSheet
      title={t('guide.welcome')}
      visible={visible}
      onCancel={onClose}
      width="min(520px, 100vw)"
      className="product-sheet guide-sheet"
      footer={
        <div className="sheet-footer">
          <span className="sheet-footer__hint">{t('guide.helpAgain')}</span>
          <Button theme="solid" onClick={onClose}>{t('guide.start')}</Button>
        </div>
      }
    >
      <div className="guide-hero">
        <div className="guide-hero__mark">BW</div>
        <div>
          <h2>{t('guide.heroTitle')}</h2>
          <p>{t('guide.heroDescription')}</p>
        </div>
      </div>

      <div className="guide-steps">
        {steps.map((step, index) => (
          <div className="guide-step" key={step.title}>
            <span className="guide-step__number">{index + 1}</span>
            <div>
              <div className="guide-step__title">{step.title}</div>
              <div className="guide-step__description">{step.description}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="guide-privacy">
        <IconLock />
        <div>
          <strong>{t('guide.localFirstTitle')}</strong>
          <span>{t('guide.localFirstDescription')}</span>
        </div>
      </div>

      <div className="guide-about">
        <span>© {COPYRIGHT_YEAR} {PRODUCT_NAME} · v{PRODUCT_VERSION}</span>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          <IconGithubLogo /> {t('header.github')}
        </a>
      </div>
    </SideSheet>
  );
}
