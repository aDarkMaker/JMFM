import styles from './datePicker.module.css';

export interface DatePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
}

/** Thin wrapper over the native date input so mobile WebViews get their own picker. */
export function DatePicker({label, value, onChange, min, max, disabled = false}: DatePickerProps) {
  return (
    <label className={styles.wrap}>
      <span className={styles.label}>{label}</span>
      <input
        className={styles.input}
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
