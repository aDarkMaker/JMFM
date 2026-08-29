import {useEffect, useRef, useState} from 'react';
import {validateTagInput} from '../library/filterTags';

export type FilterMode = 'blacklist' | 'whitelist';

export interface TagFilterPanelProps {
  mode: FilterMode;
  blacklistCount: number;
  whitelistCount: number;
  onModeChange(mode: FilterMode): void;
  tags: string[];
  suggestions: string[];
  onAdd(tag: string): void;
  onRemove(tag: string): void;
  hint: string;
  placeholder: string;
}

function messageFor(reason: 'empty' | 'duplicate' | 'blocked', tag: string): string {
  switch (reason) {
    case 'empty':
      return '输入标签后再添加';
    case 'duplicate':
      return `「${tag}」已在列表中`;
    case 'blocked':
      return '该标签不可添加';
  }
}

export function TagFilterPanel({
  mode,
  blacklistCount,
  whitelistCount,
  onModeChange,
  tags,
  suggestions,
  onAdd,
  onRemove,
  hint,
  placeholder,
}: TagFilterPanelProps) {
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const flashFeedback = (msg: string) => {
    setFeedback(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFeedback(null), 1500);
  };

  const submit = () => {
    const result = validateTagInput(value, tags);
    if (!result.ok) {
      flashFeedback(messageFor(result.reason, value.trim()));
      return;
    }
    onAdd(result.tag);
    setValue('');
    setFeedback(null);
  };

  const desc =
    mode === 'blacklist'
      ? '命中黑名单标签的漫画不会出现在首页推荐'
      : '命中白名单标签的漫画会优先出现在首页推荐';

  return (
    <div className="tag-filter-panel">
      <div className="theme-segmented tag-filter-segmented">
        <button
          className={`theme-segmented-item${mode === 'blacklist' ? ' is-active' : ''}`}
          onClick={() => onModeChange('blacklist')}
        >
          黑名单
          <span className="tag-filter-count">{blacklistCount}</span>
        </button>
        <button
          className={`theme-segmented-item${mode === 'whitelist' ? ' is-active' : ''}`}
          onClick={() => onModeChange('whitelist')}
        >
          白名单
          <span className="tag-filter-count">{whitelistCount}</span>
        </button>
      </div>

      <span className="tag-filter-desc">{desc}</span>

      {tags.length === 0 ? (
        <span className="tag-filter-empty">{hint}</span>
      ) : (
        <div className="tag-filter-list">
          {tags.map((tag) => (
            <span key={tag} className={`tag-filter-chip tag-filter-chip-${mode}`}>
              {tag}
              <button
                className="tag-filter-chip-x"
                onClick={() => onRemove(tag)}
                aria-label={`移除 ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {suggestions.length > 0 ? (
        <div className="tag-filter-suggest">
          <span className="tag-filter-suggest-title">从漫画库推荐</span>
          <div className="tag-filter-suggest-list">
            {suggestions.map((tag) => (
              <button key={tag} className="tag-filter-suggest-chip" onClick={() => onAdd(tag)}>
                {tag}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="domain-add tag-filter-add">
        <input
          className="domain-input"
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              submit();
            }
          }}
        />
        <button className="domain-add-btn" onClick={submit}>
          添加
        </button>
      </div>

      <div className="tag-filter-feedback-slot" role="status">
        {feedback ? <span className="tag-filter-feedback">{feedback}</span> : null}
      </div>
    </div>
  );
}
