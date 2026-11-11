import type {CSSProperties} from 'react';
import styles from './skeleton.module.css';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: 'sm' | 'md' | 'pill';
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({width = '100%', height = 16, radius = 'sm', className, style}: SkeletonProps) {
  return (
    <div
      className={[styles.block, styles[radius], className ?? ''].filter(Boolean).join(' ')}
      style={{width, height, ...style}}
      aria-hidden
    />
  );
}

export function SkeletonText({lines = 3, width = '100%'}: {lines?: number; width?: number | string}) {
  return (
    <div className={styles.textBlock} style={{width}} aria-hidden>
      {Array.from({length: lines}, (_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}
