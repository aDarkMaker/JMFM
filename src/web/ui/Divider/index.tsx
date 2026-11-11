import styles from './divider.module.css';

export interface DividerProps {
  /** Adds vertical breathing room around the rule. */
  spacing?: 'none' | 'sm' | 'md';
}

export function Divider({spacing = 'sm'}: DividerProps) {
  return <div className={[styles.divider, styles[spacing]].filter(Boolean).join(' ')} role="separator" />;
}
