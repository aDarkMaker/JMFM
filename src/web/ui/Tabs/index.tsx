import type {CSSProperties, ReactNode} from 'react';
import styles from './tabs.module.css';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'pill' | 'underline';
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'pill',
  className,
  style,
  ariaLabel,
}: TabsProps<T>) {
  return (
    <div
      className={[styles.tabs, styles[variant], className ?? ''].filter(Boolean).join(' ')}
      style={style}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            className={[styles.tab, active ? styles.active : ''].filter(Boolean).join(' ')}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Same API as Tabs, with a shared sliding indicator instead of per-tab fills. */
export function AnimatedTabs<T extends string>(props: TabsProps<T>) {
  return <Tabs {...props} variant="underline" />;
}
