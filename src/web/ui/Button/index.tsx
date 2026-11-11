import type {CSSProperties, ReactNode} from 'react';
import styles from './button.module.css';
import {Spinner} from '@/web/ui/Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  /** Screen-reader text when the button has no visible label. */
  ariaLabel?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  disabled = false,
  type = 'button',
  ariaLabel,
  iconLeft,
  iconRight,
  className,
  style,
  onClick,
}: ButtonProps) {
  const cls = [
    styles.button,
    styles[variant],
    styles[size],
    block ? styles.block : '',
    loading ? styles.loading : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={cls}
      style={style}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {loading ? <Spinner size={16} /> : iconLeft}
      {children != null ? <span className={styles.label}>{children}</span> : null}
      {iconRight}
    </button>
  );
}
