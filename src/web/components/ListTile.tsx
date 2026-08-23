import {Icon} from './Icon';

export interface ListTileProps {
  icon: 'home' | 'settings' | 'info' | 'folder' | 'auto-stories' | 'star' | 'download';
  title: string;
  subtitle?: string;
  trailing?: 'chevron-right';
  onClick?: () => void;
}

export function ListTile({icon, title, subtitle, trailing, onClick}: ListTileProps) {
  return (
    <button className="list-tile" onClick={onClick}>
      <span className="list-tile-icon">
        <Icon name={icon} size={22} />
      </span>
      <span className="list-tile-body">
        <span className="list-tile-title">{title}</span>
        {subtitle ? <span className="list-tile-subtitle">{subtitle}</span> : null}
      </span>
      {trailing ? (
        <span className="list-tile-trailing">
          <Icon name={trailing} size={20} />
        </span>
      ) : null}
    </button>
  );
}
