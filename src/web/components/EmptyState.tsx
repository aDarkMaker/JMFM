import {icons} from '../generated/icons';
import {Icon} from './Icon';

export interface EmptyStateProps {
  icon?: keyof typeof icons;
  title: string;
  hint?: string;
}

export function EmptyState({icon = 'folder', title, hint}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={48} />
      </span>
      <span className="empty-title">{title}</span>
      {hint ? <span className="empty-hint">{hint}</span> : null}
    </div>
  );
}
