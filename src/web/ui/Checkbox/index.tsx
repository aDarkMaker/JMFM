import styles from './checkbox.module.css';
import {Icon} from '@/web/shared/Icon';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Checkbox({checked, onChange, label, disabled = false}: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={[styles.box, checked ? styles.checked : ''].filter(Boolean).join(' ')}
      onClick={() => onChange(!checked)}
    >
      {checked ? <Icon name="check-circle" size={14} /> : null}
    </button>
  );
}
