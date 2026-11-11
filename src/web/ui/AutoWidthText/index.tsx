import type {CSSProperties, ElementType, ReactNode} from 'react';
import styles from './autoWidthText.module.css';

export interface AutoWidthTextProps {
  children: ReactNode;
  as?: ElementType;
  /** Caps the element so long text truncates instead of pushing siblings. */
  max?: string;
  className?: string;
  style?: CSSProperties;
}

export function AutoWidthText({
  children,
  as: Tag = 'span',
  max = '100%',
  className,
  style,
}: AutoWidthTextProps) {
  return (
    <Tag
      className={[styles.text, className ?? ''].filter(Boolean).join(' ')}
      style={{maxWidth: max, ...style}}
    >
      {children}
    </Tag>
  );
}
