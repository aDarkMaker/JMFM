import {useState} from 'react';
import {Icon} from './Icon';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({value, onChange, placeholder}: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  return (
    <div className={`search-bar${focused ? ' is-focused' : ''}`}>
      <span className="search-bar-icon">
        <Icon name="search" size={20} />
      </span>
      <input
        className="search-bar-input"
        type="text"
        value={value}
        placeholder={placeholder ?? '搜索'}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {value ? (
        <button className="search-bar-clear" onClick={() => onChange('')} aria-label="清空">
          <Icon name="close" size={18} />
        </button>
      ) : null}
    </div>
  );
}
