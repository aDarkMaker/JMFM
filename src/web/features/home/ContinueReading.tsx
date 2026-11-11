import {t} from '@/web/i18n';
import {useMemo} from 'react';
import styles from './continueReading.module.css';
import {useHistoryStore} from '@/web/stores/history';
import {useLibraryStore} from '@/web/stores/library';
import {Icon} from '@/web/shared/Icon';
import {Poster} from '@/web/shared/Poster';
import {hasJapanese} from '@/web/hooks/useJapaneseFont';
import {SectionHeader} from '@/web/ui/SectionHeader';
import type {ReaderTarget} from '@/web/reader/types';

export interface ContinueReadingProps {
  limit?: number;
  onOpen: (target: ReaderTarget) => void;
}

/** Horizontal resume rail; only shows entries whose local copy still exists. */
export function ContinueReading({limit = 5, onOpen}: ContinueReadingProps) {
  const entries = useHistoryStore((s) => s.entries);
  const items = useLibraryStore((s) => s.items);

  const rail = useMemo(() => {
    const byId = new Map(items.map((i) => [i.albumId, i]));
    return Object.values(entries)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter((e) => byId.get(e.albumId)?.pagesDir != null)
      .slice(0, limit)
      .map((e) => ({entry: e, item: byId.get(e.albumId)!}));
  }, [entries, items, limit]);

  if (rail.length === 0) return null;

  return (
    <section>
      <SectionHeader title={t('home.continueReading')} />
      <div className={styles.rail}>
        {rail.map(({entry, item}) => {
          const percent = entry.total > 0 ? Math.min(100, (entry.page / entry.total) * 100) : 0;
          return (
            <button
              type="button"
              key={entry.albumId}
              className={styles.card}
              onClick={() =>
                onOpen({
                  filePath: item.filePath,
                  title: item.title,
                  pageCount: item.pageCount,
                  pagesDir: item.pagesDir,
                  albumId: item.albumId,
                  startPage: entry.page,
                })
              }
            >
              <Poster
                className={styles.poster}
                coverPath={item.coverPath}
                albumDir={item.filePath}
                title={item.title}
                tintIndex={item.albumId}
                fallbackChars={2}
              />
              <span className={styles.body}>
                <span className={[styles.title, hasJapanese(entry.title) ? styles.ja : ''].filter(Boolean).join(' ')}>
                  {entry.title}
                </span>
                <span className={styles.meta}>
                  <Icon name="bookmark" size={14} />
                  {`P.${entry.page}${entry.total > 0 ? ` / ${entry.total}` : ''}`}
                </span>
                <span className={styles.track} aria-hidden>
                  <span className={styles.fill} style={{width: `${percent}%`}} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
