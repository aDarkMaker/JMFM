import {icons} from '../generated/icons';
import {Icon} from './Icon';

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
  actionLoading,
  onAction,
}: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div className="section-header-text">
        <span className="section-header-title">{title}</span>
        {subtitle ? <span className="section-header-subtitle">{subtitle}</span> : null}
      </div>
      {actionLabel ? (
        <button
          className={`section-header-action${actionLoading ? ' is-loading' : ''}`}
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
