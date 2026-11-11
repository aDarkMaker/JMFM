import {t} from '@/web/i18n';
import styles from './progressBar.module.css';

export interface ProgressBarProps {
  progress: number;
  status?: 'pending' | 'running' | 'paused' | 'done' | 'error';
  size?: 'md' | 'sm';
  showLabel?: boolean;
  indeterminate?: boolean;
  label?: string;
}

export function ProgressBar({
  progress,
  status,
  size = 'md',
  showLabel = false,
  indeterminate = false,
  label,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  const cls = [
    status === 'done' ? styles.done : '',
    status === 'error' ? styles.error : '',
    status === 'paused' ? styles.paused : '',
    indeterminate ? styles.indeterminate : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={[styles.wrap, size === 'sm' ? styles.sm : ''].filter(Boolean).join(' ')}>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : clamped}
      >
        <div
          className={[styles.fill, cls].filter(Boolean).join(' ')}
          style={indeterminate ? undefined : {width: `${clamped}%`}}
        />
      </div>
      {showLabel ? <span className={styles.label}>{indeterminate ? t('common.preparing') : `${clamped}%`}</span> : null}
    </div>
  );
}
