import styles from './switch.module.css';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Switch({checked, onChange, label, disabled = false}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={[styles.track, checked ? styles.on : ''].filter(Boolean).join(' ')}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.thumb} aria-hidden />
    </button>
  );
}
