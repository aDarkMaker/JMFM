import {t} from '@/web/i18n';
import {useState} from 'react';
import styles from './select.module.css';
import {Sheet} from '@/web/ui/Sheet';
import {Icon} from '@/web/shared/Icon';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export interface SelectProps<T extends string> {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = t('common.select'),
  disabled = false,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span className={[styles.value, current ? '' : styles.placeholder].filter(Boolean).join(' ')}>
          {current?.label ?? placeholder}
        </span>
        <span className={styles.chevron} aria-hidden>
          <Icon name="chevron-right" size={18} />
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <div className={styles.list} role="listbox" aria-label={label}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                className={[styles.option, active ? styles.active : ''].filter(Boolean).join(' ')}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className={styles.optionText}>
                  <span className={styles.optionLabel}>{option.label}</span>
                  {option.hint ? <span className={styles.optionHint}>{option.hint}</span> : null}
                </span>
                {active ? <Icon name="check-circle" size={18} /> : null}
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}
