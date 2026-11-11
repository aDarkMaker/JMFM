/**
 * Content-filter editor: one always-visible tag list where each row carries its own
 * black/white mode, plus a composer that decides where new tags land.
 */
import {t} from '@/web/i18n';
import {useMemo, useState} from 'react';
import type {KeyboardEvent} from 'react';
import type {FilterMode} from '@/web/library/filterTags';
import {validateTagInput} from '@/web/library/filterTags';
import {Input} from '@/web/ui/Input';
import {IconButton} from '@/web/ui/IconButton';
import {Chip} from '@/web/ui/Chip';
import {Divider} from '@/web/ui/Divider';
import {EmptyState} from '@/web/ui/EmptyState';
import {ConfirmDialog} from '@/web/ui/ConfirmDialog';
import {Icon} from '@/web/shared/Icon';
import styles from './tagFilter.module.css';

export interface FilterEntry {
  tag: string;
  mode: FilterMode;
}

export interface TagFilterProps {
  entries: FilterEntry[];
  blacklistCount: number;
  whitelistCount: number;
  composerMode: FilterMode;
  suggestions: string[];
  onComposerModeChange(mode: FilterMode): void;
  onAdd(tag: string): void;
  onRemove(tag: string, mode: FilterMode): void;
  onMove(tag: string, mode: FilterMode): void;
  onClear(): void;
}

export function TagFilter({
  entries,
  blacklistCount,
  whitelistCount,
  composerMode,
  suggestions,
  onComposerModeChange,
  onAdd,
  onRemove,
  onMove,
  onClear,
}: TagFilterProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const modeLabel = (mode: FilterMode) =>
    mode === 'blacklist' ? t('filter.modeBlack') : t('filter.modeWhite');

  const targetTags = useMemo(
    () => entries.filter((entry) => entry.mode === composerMode).map((entry) => entry.tag),
    [entries, composerMode]
  );

  const commit = (raw: string) => {
    // Duplicates only block the target list; a hit in the other list is a move.
    const result = validateTagInput(raw, targetTags);
    if (!result.ok) {
      setError(
        result.reason === 'empty'
          ? t('filter.errEmpty')
          : result.reason === 'duplicate'
            ? t('filter.errDuplicate', {tag: raw.trim()})
            : t('filter.errBlocked')
      );
      return;
    }
    setError(null);
    setValue('');
    onAdd(result.tag);
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commit(value);
  };

  const changeComposerMode = (mode: FilterMode) => {
    setError(null);
    onComposerModeChange(mode);
  };

  const nextMode: FilterMode = composerMode === 'blacklist' ? 'whitelist' : 'blacklist';

  return (
    <div className={styles.panel}>
      <div className={styles.composer}>
        <button
          type="button"
          className={[styles.target, styles[composerMode]].join(' ')}
          aria-label={t('filter.targetHint', {mode: modeLabel(nextMode)})}
          onClick={() => changeComposerMode(nextMode)}
        >
          {modeLabel(composerMode)}
        </button>
        <Input
          className={styles.field}
          value={value}
          placeholder={t('filter.addHint')}
          invalid={error != null}
          onChange={(next) => {
            setValue(next);
            if (error) setError(null);
          }}
          onKeyDown={onComposerKeyDown}
        />
        <IconButton
          label={t('filter.addLabel', {mode: modeLabel(composerMode)})}
          variant="accent"
          size="lg"
          onClick={() => commit(value)}
        >
          <Icon name="add" size={20} />
        </IconButton>
      </div>
      {error != null ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.summary}>
        <span className={styles.count}>{t('filter.summary', {black: blacklistCount, white: whitelistCount})}</span>
        {entries.length > 0 ? (
          <button type="button" className={styles.clear} onClick={() => setConfirmClear(true)}>
            {t('filter.clearAll')}
          </button>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <EmptyState icon="bookmark" title={t('filter.emptyTitle')} hint={t('filter.emptyHint')} />
      ) : (
        <Divider />
      )}

      {entries.length > 0 ? (
        <div className={styles.list}>
          {entries.map((entry) => (
            <div key={`${entry.mode}:${entry.tag}`} className={styles.row}>
              <button
                type="button"
                className={[styles.pill, styles[entry.mode]].join(' ')}
                aria-label={t('filter.moveTo', {
                  tag: entry.tag,
                  mode: modeLabel(entry.mode === 'blacklist' ? 'whitelist' : 'blacklist'),
                })}
                onClick={() => onMove(entry.tag, entry.mode)}
              >
                <Icon name="sync" size={12} />
                {modeLabel(entry.mode)}
              </button>
              <span className={styles.tag}>{entry.tag}</span>
              <IconButton
                className={styles.rowAction}
                label={t('filter.removeTag', {tag: entry.tag})}
                variant="plain"
                size="md"
                onClick={() => onRemove(entry.tag, entry.mode)}
              >
                <Icon name="close" size={18} />
              </IconButton>
            </div>
          ))}
        </div>
      ) : null}

      {suggestions.length > 0 ? (
        <div className={styles.suggest}>
          <span className={styles.suggestTitle}>{t('filter.suggest')}</span>
          <div className={styles.suggestList}>
            {suggestions.map((tag) => (
              <Chip key={tag} size="sm" onClick={() => commit(tag)}>
                <Icon name="add" size={12} />
                {tag}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmClear}
        title={t('filter.clearTitle')}
        message={t('filter.clearMessage')}
        confirmLabel={t('common.clear')}
        danger
        onConfirm={() => {
          setConfirmClear(false);
          onClear();
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
