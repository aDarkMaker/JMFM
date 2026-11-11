import type {ReactNode} from 'react';
import styles from './emptyState.module.css';
import {Icon} from '@/web/shared/Icon';
import type {icons} from '@/web/generated/icons';

export interface EmptyStateProps {
  icon?: keyof typeof icons;
  title?: string;
  hint?: string;
  action?: ReactNode;
  /** Fill the available space instead of sitting inline. */
  fill?: boolean;
}

export function EmptyState({icon, title, hint, action, fill = false}: EmptyStateProps) {
  return (
    <div className={[styles.empty, fill ? styles.fill : ''].filter(Boolean).join(' ')}>
      {icon ? (
        <span className={styles.icon} aria-hidden>
          <Icon name={icon} size={48} />
        </span>
      ) : null}
      {title ? <span className={styles.title}>{title}</span> : null}
      {hint ? <span className={styles.hint}>{hint}</span> : null}
      {action}
    </div>
  );
}
