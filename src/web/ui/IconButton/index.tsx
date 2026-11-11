import type {CSSProperties, ReactNode} from 'react';
import styles from './iconButton.module.css';

export type IconButtonSize = 'sm' | 'md' | 'lg';
export type IconButtonVariant = 'plain' | 'soft' | 'accent';

export interface IconButtonProps {
  /** Screen-reader text. Required: the button has no visible label. */
  label: string;
  children: ReactNode;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function IconButton({
  label,
  children,
  size = 'md',
  variant = 'plain',
  active = false,
  disabled = false,
  className,
  style,
  onClick,
}: IconButtonProps) {
  const cls = [
    styles.iconButton,
    styles[size],
    styles[variant],
    active ? styles.active : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={cls}
      style={style}
      aria-label={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}
