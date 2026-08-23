import {icons} from '../generated/icons';
import {Icon} from './Icon';

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  actionIcon?: keyof typeof icons;
  onAction?: () => void;
}

export function SectionHeader({title, actionLabel, actionIcon, onAction}: SectionHeaderProps) {
  return (
    <div className="section-header">
      <span className="section-header-title">{title}</span>
      {actionLabel ? (
        <button className="section-header-action" onClick={onAction}>
          {actionIcon ? <Icon name={actionIcon} size={16} /> : null}
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
