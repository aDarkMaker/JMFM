import styles from './spinner.module.css';

export interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

export function Spinner({size = 20, className, label}: SpinnerProps) {
  return (
    <span
      className={[styles.spinner, className ?? ''].filter(Boolean).join(' ')}
      style={{width: size, height: size, borderWidth: Math.max(2, Math.round(size / 9))}}
      role="progressbar"
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
