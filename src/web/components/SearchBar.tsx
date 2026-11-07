import {forwardRef, useState, useRef} from 'react';
import {Icon} from './Icon';

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
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  {value, onChange, placeholder, onSubmit, autoFocus, onFocus, onBlur, readOnly},
  ref
) {
  const [focused, setFocused] = useState(false);
  const composingRef = useRef(false);

  return (
    <div className={`search-bar${focused ? ' is-focused' : ''}`}>
      <span className="search-bar-icon" aria-hidden>
        <Icon name="search" size={18} />
      </span>
      <input
        ref={ref}
        className="search-bar-input"
        type="search"
        enterKeyHint="search"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder ?? '搜索'}
        autoFocus={autoFocus}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
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
      {value ? (
        <button
          type="button"
          className="search-bar-clear"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange('')}
          aria-label="清空"
        >
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </div>
  );
});
