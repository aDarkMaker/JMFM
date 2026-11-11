import styles from './avatar.module.css';

export interface AvatarProps {
  src?: string | null;
  fallback?: string;
  size?: number;
  label?: string;
}

export function Avatar({src, fallback, size = 40, label}: AvatarProps) {
  const initial = (fallback ?? '?').trim().slice(0, 1).toUpperCase();
  return (
    <span
      className={styles.avatar}
      style={{width: size, height: size, fontSize: Math.max(12, Math.round(size / 2.5))}}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {src ? <img className={styles.image} src={src} alt="" /> : initial}
    </span>
  );
}
