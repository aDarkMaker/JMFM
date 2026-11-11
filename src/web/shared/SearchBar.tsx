import {t} from '@/web/i18n';
import {forwardRef, useRef} from 'react';
import styles from './searchBar.module.css';
import {Icon} from '@/web/shared/Icon';
import {Input} from '@/web/ui/Input';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Enter key / IME confirm handler. */
  onSubmit?: (value: string) => void;
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  readOnly?: boolean;
  variant?: 'default' | 'nav' | 'home';
  /** Home variant: parent expanded state drives the raised surface. */
  expanded?: boolean;
}

/** Search field built on ui/Input, so every page shares one field geometry. */
export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  {
    value,
    onChange,
    placeholder,
    onSubmit,
    autoFocus,
    onFocus,
    onBlur,
    readOnly,
    variant = 'default',
    expanded = false,
  },
  ref
) {
  const composingRef = useRef(false);

  const cls = [
    styles.host,
    variant === 'home' ? styles.home : '',
    variant === 'home' && expanded ? styles.homeExpanded : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Input
      ref={ref}
      className={cls}
      variant={variant === 'default' ? 'capsule' : 'flat'}
      focusRing={variant !== 'home'}
      type="search"
      enterKeyHint="search"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      value={value}
      placeholder={placeholder ?? t('common.search')}
      autoFocus={autoFocus}
      readOnly={readOnly}
      iconLeft={<Icon name="search" size={18} />}
      suffix={
        value ? (
          <button
            type="button"
            className={styles.clear}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange('')}
            aria-label={t('common.clear')}
          >
            <Icon name="close" size={16} />
          </button>
        ) : undefined
      }
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={(e) => {
        composingRef.current = false;
        onChange(e.currentTarget.value);
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' || composingRef.current) return;
        e.preventDefault();
        onSubmit?.(e.currentTarget.value);
      }}
    />
  );
});
