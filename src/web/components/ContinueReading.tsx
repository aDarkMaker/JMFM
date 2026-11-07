import {useMemo} from 'react';
import {useHistoryStore} from '../stores/history';
import {useLibraryStore} from '../stores/library';
import {Icon} from './Icon';
import {Poster} from './Poster';
import {hasJapanese} from '../hooks/useJapaneseFont';
import type {ReaderTarget} from '../reader/types';

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
    <section className="continue-section">
      <div className="section-header">
        <span className="section-header-title">继续阅读</span>
      </div>
      <div className="continue-rail">
      {rail.map(({entry, item}) => {
        const percent = entry.total > 0 ? Math.min(100, (entry.page / entry.total) * 100) : 0;
        return (
          <button
            key={entry.albumId}
            className="continue-card"
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
              className="continue-poster"
              coverPath={item.coverPath}
              albumDir={item.filePath}
              title={item.title}
              tintIndex={item.albumId}
              fallbackChars={2}
            />
            <span className="continue-body">
              <span className={`continue-title${hasJapanese(entry.title) ? ' is-ja' : ''}`}>
                {entry.title}
              </span>
              <span className="continue-meta">
                <Icon name="bookmark" size={14} />
                {`P.${entry.page}${entry.total > 0 ? ` / ${entry.total}` : ''}`}
              </span>
              <span className="continue-track" aria-hidden>
                <span className="continue-fill" style={{width: `${percent}%`}} />
              </span>
            </span>
          </button>
        );
      })}
      </div>
    </section>
  );
}
