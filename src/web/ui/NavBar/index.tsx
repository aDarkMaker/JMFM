import {t} from '@/web/i18n';
import type {ReactNode} from 'react';
import styles from './navBar.module.css';
import {IconButton} from '@/web/ui/IconButton';
import {Icon} from '@/web/shared/Icon';

export interface NavBarProps {
  title?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  left?: ReactNode;
  right?: ReactNode;
  /** Renders a flat bar with no raised surface. */
  flat?: boolean;
  /** Wraps the bar content in a search-style layout. */
  search?: boolean;
  barClassName?: string;
}

export function NavBar({
  title,
  onBack,
  backLabel = t('common.back'),
  left,
  right,
  flat = false,
  search = false,
  barClassName,
}: NavBarProps) {
  const cls = [styles.bar, flat ? styles.flat : '', search ? styles.search : '', barClassName ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls}>
      {onBack ? (
        <IconButton label={backLabel} onClick={onBack}>
          <Icon name="arrow-back" size={24} />
        </IconButton>
      ) : null}
      {left}
      {title != null ? <span className={styles.title}>{title}</span> : null}
      {right}
    </div>
  );
}
