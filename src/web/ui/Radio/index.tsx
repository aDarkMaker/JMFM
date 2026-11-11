import styles from './radio.module.css';

export interface RadioOption<T extends string> {
  value: T;
  label: string;
}

export interface RadioGroupProps<T extends string> {
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
}

export function RadioGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
}: RadioGroupProps<T>) {
  return (
    <div className={styles.group} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            className={[styles.row, checked ? styles.checked : ''].filter(Boolean).join(' ')}
            onClick={() => onChange(option.value)}
          >
            <span className={styles.dot} aria-hidden>
              {checked ? <span className={styles.dotInner} /> : null}
            </span>
            <span className={styles.label}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
