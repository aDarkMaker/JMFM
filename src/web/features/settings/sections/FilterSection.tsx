/**
 * Settings → content filter: owns the two persisted tag lists and their
 * mutual-exclusion invariant; TagFilter stays purely presentational.
 */
import {t} from '@/web/i18n';
import {useMemo, useState} from 'react';
import {useLibraryStore} from '@/web/stores/library';
import {
  removeFilterTag,
  setFilterTag,
  suggestFilterTags,
  type FilterMode,
} from '@/web/library/filterTags';
import {ListGroup} from '@/web/ui/ListGroup';
import type {Settings} from '@/data/settings';
import type {FilterEntry} from './TagFilter';
import {TagFilter} from './TagFilter';
import styles from '../settings.module.css';

export interface FilterSectionProps {
  settings: Settings;
  update(patch: Partial<Settings>): void;
}

export function FilterSection({settings, update}: FilterSectionProps) {
  const libraryItems = useLibraryStore((s) => s.items);
  const [composerMode, setComposerMode] = useState<FilterMode>('blacklist');

  const lists = {blacklistTags: settings.blacklistTags, whitelistTags: settings.whitelistTags};

  // Blacklist first, then whitelist; each keeps its stored order so rows never jump.
  const entries = useMemo<FilterEntry[]>(
    () => [
      ...settings.blacklistTags.map((tag) => ({tag, mode: 'blacklist' as const})),
      ...settings.whitelistTags.map((tag) => ({tag, mode: 'whitelist' as const})),
    ],
    [settings.blacklistTags, settings.whitelistTags]
  );

  const suggestions = useMemo(
    () => suggestFilterTags(libraryItems, [...settings.blacklistTags, ...settings.whitelistTags]),
    [libraryItems, settings.blacklistTags, settings.whitelistTags]
  );

  const add = (tag: string) => {
    void update(setFilterTag(lists, tag, composerMode));
  };

  const remove = (tag: string, mode: FilterMode) => {
    void update(removeFilterTag(lists, tag, mode));
  };

  const move = (tag: string, from: FilterMode) => {
    void update(setFilterTag(lists, tag, from === 'blacklist' ? 'whitelist' : 'blacklist'));
  };

  return (
    <ListGroup title={t('settings.filter')} hint={t('settings.filterHint')}>
      <div className={styles.filterBody}>
        <TagFilter
          entries={entries}
          blacklistCount={settings.blacklistTags.length}
          whitelistCount={settings.whitelistTags.length}
          composerMode={composerMode}
          suggestions={suggestions}
          onComposerModeChange={setComposerMode}
          onAdd={add}
          onRemove={remove}
          onMove={move}
          onClear={() => void update({blacklistTags: [], whitelistTags: []})}
        />
      </div>
    </ListGroup>
  );
}
