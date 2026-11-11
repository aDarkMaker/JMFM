import styles from './badge.module.css';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

export interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  size?: 'sm' | 'md';
}

export function Badge({children, tone = 'neutral', size = 'sm'}: BadgeProps) {
  return (
    <span className={[styles.badge, styles[tone], styles[size]].filter(Boolean).join(' ')}>
      {children}
    </span>
  );
}

export interface RedDotProps {
  label?: string;
}

export function RedDot({label}: RedDotProps) {
  return <span className={styles.dot} role={label ? 'status' : undefined} aria-label={label} />;
}
