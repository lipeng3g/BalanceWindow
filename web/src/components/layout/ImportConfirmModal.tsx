import { useEffect, useState } from 'react';
import { Banner, Modal, Radio, RadioGroup } from '@douyinfe/semi-ui';
import type { AppData } from '@/types';
import type { ImportMode } from '@/store/types';
import { summarize } from '@/utils/backup';
import { useI18n } from '@/i18n';

interface Props {
  data: AppData | null;
  onConfirm: (mode: ImportMode) => void;
  onClose: () => void;
}

export default function ImportConfirmModal({ data, onConfirm, onClose }: Props) {
  const { t } = useI18n();
  const [mode, setMode] = useState<ImportMode>('replace');

  useEffect(() => {
    if (data) setMode('replace');
  }, [data]);

  const summary = data ? summarize(data) : null;

  return (
    <Modal
      title={t('header.import')}
      visible={data !== null}
      onCancel={onClose}
      onOk={() => onConfirm(mode)}
      okText={t('import.confirm')}
      cancelText={t('common.cancel')}
      width={440}
    >
      {summary && (
        <div className="import-confirm">
          <Banner
            type="info"
            closeIcon={null}
            description={t('import.summary', {
              version: summary.version,
              accounts: summary.accounts,
              transactions: summary.transactions,
              series: summary.series,
              categories: summary.categories,
            })}
          />
          <div className="form-field">
            <label className="form-label">{t('import.mode')}</label>
            <RadioGroup
              direction="vertical"
              value={mode}
              onChange={(e) => setMode(e.target.value as ImportMode)}
            >
              <Radio value="replace">{t('import.replace')}</Radio>
              <Radio value="merge">{t('import.merge')}</Radio>
            </RadioGroup>
          </div>
        </div>
      )}
    </Modal>
  );
}
