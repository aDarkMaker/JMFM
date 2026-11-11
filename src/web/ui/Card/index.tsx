import type {CSSProperties, ReactNode} from 'react';
import styles from './card.module.css';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps {
  children: ReactNode;
  padding?: CardPadding;
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Card({
  children,
  padding = 'md',
  interactive = false,
  className,
  style,
  onClick,
}: CardProps) {
  const cls = [
    styles.card,
    styles[`pad-${padding}`],
    interactive ? styles.interactive : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  if (interactive || onClick) {
    return (
      <button type="button" className={cls} style={style} onClick={onClick}>
        {children}
      </button>
    );
  }

  return (
    <div className={cls} style={style}>
      {children}
    </div>
  );
}
