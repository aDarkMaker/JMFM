import type {CSSProperties, ReactNode} from 'react';
import styles from './listTile.module.css';
import {Icon} from '@/web/shared/Icon';
import {icons} from '@/web/generated/icons';
import {Input} from '@/web/ui/Input';
import {Switch} from '@/web/ui/Switch';

const ICON_NAMES = new Set(Object.keys(icons));

export type ListTileVariant = 'card' | 'plain';

export interface ListTileProps {
  icon?: keyof typeof icons;
  title: string;
  subtitle?: string;
  /** `plain` drops the own surface so rows can stack inside ui/ListGroup. */
  variant?: ListTileVariant;
  trailing?: keyof typeof icons | ReactNode;
  onClick?: () => void;
  loading?: boolean;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  inputPlaceholder?: string;
  inputReadOnly?: boolean;
  toggleValue?: boolean;
  onToggleChange?: (value: boolean) => void;
  className?: string;
  style?: CSSProperties;
}

export function ListTile({
  icon,
  title,
  subtitle,
  variant = 'card',
  trailing,
  onClick,
  loading = false,
  inputValue,
  onInputChange,
  inputPlaceholder,
  inputReadOnly,
  toggleValue,
  onToggleChange,
  className,
  style,
}: ListTileProps) {
  const isInput = inputValue !== undefined;
  const isToggle = toggleValue !== undefined;
  const isIconName = (v: unknown): v is keyof typeof icons =>
    typeof v === 'string' && ICON_NAMES.has(v);
  // Interactive trailing content must not nest inside a button element.
  const hasCustomTrailing = trailing !== undefined && !isIconName(trailing);
  const interactive = !isInput && !isToggle && !hasCustomTrailing && onClick != null;

  const cls = [
    styles.tile,
    variant === 'plain' ? styles.plain : '',
    isInput ? styles.input : '',
    loading ? styles.loading : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const header = (
    <>
      {icon ? (
        <span className={styles.icon} aria-hidden>
          <Icon name={icon} size={isInput ? 20 : 22} />
        </span>
      ) : null}
    </>
  );

  const body = (
    <>
      <span className={styles.body}>
        <span className={styles.title}>{title}</span>
        {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
      </span>
    </>
  );

  const trailingNode =
    isToggle && onToggleChange ? (
      <span className={styles.trailing}>
        <Switch label={title} checked={toggleValue} onChange={onToggleChange} />
      </span>
    ) : trailing !== undefined && !isInput ? (
      <span className={styles.trailing}>
        {isIconName(trailing) ? <Icon name={trailing} size={20} /> : trailing}
      </span>
    ) : onClick && !isInput ? (
      <span className={styles.trailing} aria-hidden>
        <Icon name="chevron-right" size={20} />
      </span>
    ) : null;

  if (isInput) {
    return (
      <div className={cls} style={style} role="group">
        <div className={styles.inputHeader}>
          {header}
          <span className={styles.title}>{title}</span>
        </div>
        <Input
          value={inputValue}
          onChange={(v) => onInputChange?.(v)}
          placeholder={inputPlaceholder}
          readOnly={inputReadOnly}
          inputMode="text"
          onClick={inputReadOnly ? onClick : undefined}
        />
      </div>
    );
  }

  if (!interactive) {
    return (
      <div className={cls} style={style} role="group">
        {header}
        {body}
        {trailingNode}
      </div>
    );
  }

  return (
    <button type="button" className={cls} style={style} onClick={onClick} disabled={loading}>
      {header}
      {body}
      {trailingNode}
    </button>
  );
}
