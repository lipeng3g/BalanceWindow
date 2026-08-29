import { PALETTE } from '@/utils/palette';
import { useI18n } from '@/i18n';

interface Props {
  value: string;
  onChange: (color: string) => void;
}

export default function ColorSwatchPicker({ value, onChange }: Props) {
  const { t } = useI18n();
  return (
    <div className="swatch-grid">
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          className={`swatch${color === value ? ' is-active' : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
          aria-label={t('common.chooseColor', { color })}
        />
      ))}
    </div>
  );
}
