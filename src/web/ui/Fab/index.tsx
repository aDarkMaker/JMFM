import type {CSSProperties, ReactNode} from 'react';
import styles from './fab.module.css';

export interface FabProps {
  label: string;
  children: ReactNode;
  /** Distance from the bottom edge; the tab bar normally sits there. */
  offset?: 'tabbar' | 'none';
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Fab({label, children, offset = 'tabbar', className, style, onClick}: FabProps) {
  return (
    <button
      type="button"
      className={[styles.fab, offset === 'tabbar' ? styles.aboveTabbar : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      style={style}
      aria-label={label}
      onClick={onClick}
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}
