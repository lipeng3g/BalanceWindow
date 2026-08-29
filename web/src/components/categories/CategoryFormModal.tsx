import { useEffect, useState } from 'react';
import { Input, Modal, Toast } from '@douyinfe/semi-ui';
import type { Category } from '@/types';
import ColorSwatchPicker from '@/components/common/ColorSwatchPicker';
import { useStore } from '@/store/useStore';
import { randomColor } from '@/utils/palette';
import { useI18n } from '@/i18n';
import { DATA_LIMITS } from '@/config/dataLimits';

interface Props {
  visible: boolean;
  category: Category | null;
  onClose: () => void;
}

export default function CategoryFormModal({ visible, category, onClose }: Props) {
  const { t } = useI18n();
  const addCategory = useStore((s) => s.addCategory);
  const updateCategory = useStore((s) => s.updateCategory);

  const [name, setName] = useState('');
  const [color, setColor] = useState(randomColor);

  useEffect(() => {
    if (!visible) return;
    setName(category?.name ?? '');
    setColor(category?.color ?? randomColor());
  }, [visible, category]);

  const handleOk = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Toast.warning(t('categories.nameRequired'));
      return;
    }
    if (category) updateCategory(category.id, { name: trimmed, color });
    else addCategory({ name: trimmed, color });
    onClose();
  };

  return (
    <Modal
      title={category ? t('categories.edit') : t('categories.new')}
      visible={visible}
      onOk={handleOk}
      onCancel={onClose}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
    >
      <div className="form-field">
        <label className="form-label">{t('categories.name')}</label>
        <Input
          value={name}
          onChange={setName}
          placeholder={t('categories.namePlaceholder')}
          maxLength={DATA_LIMITS.categoryNameInput}
          showClear
        />
      </div>
      <div className="form-field">
        <label className="form-label">{t('categories.color')}</label>
        <ColorSwatchPicker value={color} onChange={setColor} />
      </div>
    </Modal>
  );
}
