import { useState } from 'react';
import { Button, Popconfirm, SideSheet, Toast } from '@douyinfe/semi-ui';
import { IconDelete, IconEdit, IconImport, IconPlus } from '@douyinfe/semi-icons';
import type { Category } from '@/types';
import EmptyState from '@/components/common/EmptyState';
import { useStore } from '@/store/useStore';
import { DEFAULT_CATEGORY_SEEDS } from '@/utils/seed';
import CategoryFormModal from './CategoryFormModal';
import { useI18n } from '@/i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function CategoryManager({ visible, onClose }: Props) {
  const { t } = useI18n();
  const categories = useStore((s) => s.categories);
  const addCategory = useStore((s) => s.addCategory);
  const removeCategory = useStore((s) => s.removeCategory);

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormVisible(true);
  };
  const openEdit = (c: Category) => {
    setEditing(c);
    setFormVisible(true);
  };

  const loadPresets = () => {
    const existing = new Set(categories.map((c) => c.name));
    const added = DEFAULT_CATEGORY_SEEDS.filter((s) => !existing.has(s.name));
    added.forEach((s) => addCategory({ name: s.name, color: s.color }));
    Toast.success(added.length
      ? t('category.loaded', { count: added.length })
      : t('category.allPresent'));
  };

  return (
    <SideSheet
      title={t('header.categories')}
      visible={visible}
      onCancel={onClose}
      width="min(440px, 100vw)"
      className="product-sheet"
      footer={
        <div className="sheet-footer category-footer">
          <Button theme="borderless" icon={<IconImport />} onClick={loadPresets}>
            {t('categories.loadPresets')}
          </Button>
          <Button theme="solid" icon={<IconPlus />} onClick={openCreate}>
            {t('categories.new')}
          </Button>
        </div>
      }
    >
      {categories.length === 0 ? (
        <EmptyState
          title={t('categories.emptyTitle')}
          description={t('categories.emptyDescription')}
          action={
            <Button theme="solid" icon={<IconImport />} onClick={loadPresets}>
              {t('categories.loadPresets')}
            </Button>
          }
        />
      ) : (
        <div className="category-list">
          {categories.map((c) => (
            <div className="category-row" key={c.id}>
              <span className="account-dot" style={{ background: c.color }} />
              <span className="category-name">{c.name}</span>
              <Button
                size="small"
                theme="borderless"
                type="tertiary"
                icon={<IconEdit />}
                onClick={() => openEdit(c)}
                aria-label={t('common.edit')}
              />
              <Popconfirm
              title={t('categories.deleteTitle')}
              content={t('categories.deleteConfirm')}
                okType="danger"
                onConfirm={() => removeCategory(c.id)}
              okText={t('common.delete')}
              cancelText={t('common.cancel')}
              >
                <Button
                  size="small"
                  theme="borderless"
                  type="danger"
                  icon={<IconDelete />}
                  aria-label={t('common.delete')}
                />
              </Popconfirm>
            </div>
          ))}
        </div>
      )}
      <CategoryFormModal
        visible={formVisible}
        category={editing}
        onClose={() => setFormVisible(false)}
      />
    </SideSheet>
  );
}
