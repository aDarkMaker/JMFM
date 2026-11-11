import type {InputHTMLAttributes, ReactNode} from 'react';
import {forwardRef, useState} from 'react';
import styles from './input.module.css';

export type InputVariant = 'default' | 'capsule' | 'flat' | 'borderless';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  /** Surface treatment; the native `type` attribute stays free for callers. */
  variant?: InputVariant;
  invalid?: boolean;
  /** Set to false when the caller renders its own focused affordance. */
  focusRing?: boolean;
  iconLeft?: ReactNode;
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    value,
    onChange,
    variant = 'default',
    invalid = false,
    focusRing = true,
    iconLeft,
    suffix,
    className,
    onFocus,
    onBlur,
    ...rest
  },
  ref
) {
  const [focused, setFocused] = useState(false);
  const cls = [
    styles.field,
    styles[variant],
    focused && focusRing ? styles.focused : '',
    invalid ? styles.invalid : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls}>
      {iconLeft ? (
        <span className={styles.icon} aria-hidden>
          {iconLeft}
        </span>
      ) : null}
      <input
        ref={ref}
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
      {suffix ? <span className={styles.suffix}>{suffix}</span> : null}
    </div>
  );
});
