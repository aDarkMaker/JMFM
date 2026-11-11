import {t} from '@/web/i18n';
import type {CSSProperties, ReactNode} from 'react';
import styles from './chip.module.css';

export type ChipSize = 'sm' | 'md';

export interface ChipProps {
  children: ReactNode;
  active?: boolean;
  size?: ChipSize;
  disabled?: boolean;
  /** Renders a trailing remove affordance; ignored when the chip is not interactive. */
  onRemove?: () => void;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Chip({
  children,
  active = false,
  size = 'md',
  disabled = false,
  onRemove,
  className,
  style,
  onClick,
}: ChipProps) {
  const cls = [styles.chip, styles[size], active ? styles.active : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  const content = (
    <>
      <span className={styles.label}>{children}</span>
      {onRemove ? (
        <span
          className={styles.remove}
          role="button"
          tabIndex={-1}
          aria-label={t('common.remove')}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </span>
      ) : null}
    </>
  );

  if (!onClick) {
    return (
      <span className={cls} style={style}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      style={style}
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
    >
      {content}
    </button>
  );
}

export interface ChipRowProps {
  children: ReactNode;
  className?: string;
  /** Smaller top padding for a second stacked rail. */
  muted?: boolean;
  label?: string;
}

export function ChipRow({children, className, muted, label}: ChipRowProps) {
  return (
    <div
      className={[styles.row, muted ? styles.rowMuted : '', className ?? ''].filter(Boolean).join(' ')}
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  );
}
