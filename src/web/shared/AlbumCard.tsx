import {t} from '@/web/i18n';
import {memo} from 'react';
import styles from './albumCard.module.css';
import posterStyles from './poster.module.css';
import {Icon} from '@/web/shared/Icon';
import {Poster} from '@/web/shared/Poster';
import {hasJapanese} from '@/web/hooks/useJapaneseFont';

export interface AlbumCardData {
  albumId: number;
  title: string;
  author?: string;
  tags?: string[];
  chapterCount?: number;
  pageCount?: number;
  coverColor?: string;
  coverPath?: string;
  filePath?: string;
  favorite?: boolean;
  /** Pages read / total pages, rendered as a thin bar under the meta row. */
  progress?: {page: number; total: number};
}

export interface AlbumCardProps {
  album: AlbumCardData;
  onPress?: (album: AlbumCardData) => void;
  onFavorite?: (album: AlbumCardData) => void;
  onDelete?: (album: AlbumCardData) => void;
  onDownload?: (album: AlbumCardData) => void;
  onDismiss?: (album: AlbumCardData) => void;
  downloading?: boolean;
  leaving?: boolean;
}

export const AlbumCard = memo(function AlbumCard({
  album,
  onPress,
  onFavorite,
  onDelete,
  onDownload,
  onDismiss,
  downloading,
  leaving,
}: AlbumCardProps) {
  const tags = album.tags ?? [];
  const metaParts = [
    album.chapterCount != null ? t('common.chapters', {count: album.chapterCount}) : null,
    album.pageCount != null ? t('common.pages', {count: album.pageCount}) : null,
  ].filter(Boolean);

  return (
    <div
      className={[styles.root, leaving ? styles.leaving : ''].filter(Boolean).join(' ')}
      role="button"
      tabIndex={0}
      onClick={() => onPress?.(album)}
      aria-label={album.title}
    >
      <Poster
        coverPath={album.coverPath}
        albumDir={album.filePath}
        title={album.title}
        tintIndex={album.albumId}
        scrim={tags.length > 0}
        className={styles.posterSlot}
      >
        {tags.length > 0 ? (
          <span className={posterStyles.tags}>
            {tags.slice(0, 2).map((tag) => (
              <span
                className={[styles.tag, hasJapanese(tag) ? styles.tagJa : ''].filter(Boolean).join(' ')}
                key={tag}
              >
                {tag}
              </span>
            ))}
          </span>
        ) : null}
        {onFavorite || onDownload || onDelete || onDismiss ? (
          <div className={styles.actions}>
            {onDismiss ? (
              <div className={styles.actionsStart}>
                <button
                  type="button"
                  className={styles.corner}
                  aria-label={t('home.dismiss')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(album);
                  }}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ) : null}
            {onFavorite || onDownload || onDelete ? (
              <div className={styles.actionsEnd}>
                {onFavorite ? (
                  <button
                    type="button"
                    className={[styles.corner, album.favorite ? styles.cornerActive : ''].filter(Boolean).join(' ')}
                    aria-label={t('common.favorite')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFavorite(album);
                    }}
                  >
                    <Icon name="favorite" size={16} />
                  </button>
                ) : null}
                {onDownload ? (
                  <button
                    type="button"
                    className={[styles.corner, styles.cornerDownload].join(' ')}
                    aria-label={downloading ? t('common.queued') : t('common.addDownload')}
                    disabled={downloading}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!downloading) onDownload(album);
                    }}
                  >
                    <Icon name={downloading ? 'download-done' : 'download'} size={16} />
                  </button>
                ) : null}
                {onDelete ? (
                  <button
                    type="button"
                    className={styles.corner}
                    aria-label={t('common.delete')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(album);
                    }}
                  >
                    <Icon name="delete" size={16} />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Poster>
      {album.progress && album.progress.total > 0 ? (
        <span className={styles.progressTrack} aria-hidden>
          <span
            className={styles.progressFill}
            style={{
              width: `${Math.min(100, (album.progress.page / album.progress.total) * 100)}%`,
            }}
          />
        </span>
      ) : null}
      <div className={styles.info}>
        <span className={[styles.title, hasJapanese(album.title) ? styles.titleJa : ''].filter(Boolean).join(' ')}>
          {album.title}
        </span>
        {album.author ? (
          <span className={[styles.meta, hasJapanese(album.author) ? styles.metaJa : ''].filter(Boolean).join(' ')}>
            {album.author}
          </span>
        ) : null}
        <span className={styles.stats}>
          <span className={styles.statsId}>ID {album.albumId}</span>
          {metaParts.length > 0 ? <span className={styles.statsMeta}>{metaParts.join('')}</span> : null}
        </span>
      </div>
    </div>
  );
});
