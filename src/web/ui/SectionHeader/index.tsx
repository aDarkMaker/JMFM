import {Icon} from '@/web/shared/Icon';
import type {icons} from '@/web/generated/icons';
import styles from './sectionHeader.module.css';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionIcon?: keyof typeof icons;
  actionLoading?: boolean;
  onAction?: () => void;
}

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  actionIcon,
  actionLoading = false,
  onAction,
}: SectionHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.text}>
        <span className={styles.title}>{title}</span>
        {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
      </div>
      {actionLabel ? (
        <button
          type="button"
          className={[styles.action, actionLoading ? styles.actionLoading : ''].filter(Boolean).join(' ')}
          onClick={onAction}
          disabled={actionLoading}
        >
          {actionIcon ? <Icon name={actionIcon} size={16} /> : null}
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
