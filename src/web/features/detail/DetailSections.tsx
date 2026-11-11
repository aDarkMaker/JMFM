import type {AlbumSummary, Episode} from '@/core/model';
import {t} from '@/web/i18n';
import styles from './detail.module.css';

export function DetailChapters({
  episodes,
  pageCount,
  currentSort,
  resumePage,
  hasHistory,
  onOpen,
}: {
  episodes: Episode[];
  pageCount?: number;
  currentSort?: number;
  resumePage: number;
  hasHistory: boolean;
  onOpen: (chapterSort: number, startPage?: number) => void;
}) {
  return (
    <div className={styles.section}>
      <span className={styles.blockTitle}>
        {episodes.length > 1 ? t('detail.chaptersCount', {count: episodes.length}) : t('detail.chapters')}
      </span>
      {episodes.length > 1 ? (
        <div className={styles.chapterGrid}>
          {episodes.map((ep) => {
            const current = currentSort === ep.sort;
            return (
              <button
                key={ep.photoId}
                type="button"
                className={[styles.chapter, current ? styles.chapterCurrent : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onOpen(ep.sort, current ? resumePage : undefined)}
              >
                {ep.name?.trim() ? ep.name : t('detail.chapterN', {n: ep.sort})}
              </button>
            );
          })}
        </div>
      ) : (
        <button
          type="button"
          className={[styles.chapter, styles.chapterWide].join(' ')}
          onClick={() => onOpen(episodes[0].sort, hasHistory ? resumePage : undefined)}
        >
          {t('detail.pagesSummary', {pages: pageCount ?? episodes.length})}
          {hasHistory ? t('detail.continueFrom', {page: resumePage}) : t('detail.fromStart')}
        </button>
      )}
    </div>
  );
}

export function DetailRelated({
  albums,
  onOpen,
}: {
  albums: AlbumSummary[];
  onOpen: (albumId: number, title: string) => void;
}) {
  if (albums.length === 0) return null;
  return (
    <div className={styles.section}>
      <span className={styles.blockTitle}>{t('detail.related')}</span>
      <div className={styles.rail}>
        {albums.slice(0, 12).map((album) => (
          <button
            key={album.albumId}
            type="button"
            className={styles.relatedCard}
            onClick={() => onOpen(album.albumId, album.name)}
          >
            <span className={styles.relatedCover}>
              {album.coverUrl ? <img src={album.coverUrl} alt="" loading="lazy" /> : null}
            </span>
            <span className={styles.relatedTitle}>{album.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
