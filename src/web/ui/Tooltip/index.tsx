import {useState} from 'react';
import type {ReactNode} from 'react';
import styles from './tooltip.module.css';

export interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: 'top' | 'bottom';
}

export function Tooltip({content, children, side = 'top'}: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className={styles.wrap}
      onPointerEnter={() => setVisible(true)}
      onPointerLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible ? (
        <span className={[styles.bubble, styles[side]].join(' ')} role="tooltip">
          {content}
        </span>
      ) : null}
    </span>
  );
}
