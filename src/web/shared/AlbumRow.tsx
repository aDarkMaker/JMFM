import {t} from '@/web/i18n';
import {memo} from 'react';
import type {AlbumSummary} from '@/core/model';
import type {icons} from '@/web/generated/icons';
import styles from './albumRow.module.css';
import {Icon} from '@/web/shared/Icon';
import {Poster} from '@/web/shared/Poster';
import {hasJapanese} from '@/web/hooks/useJapaneseFont';

export interface AlbumRowProps {
  album: AlbumSummary;
  onPress: (album: AlbumSummary) => void;
  onDownload?: (album: AlbumSummary) => void;
  downloading?: boolean;
  /** Highlight when this album is the user's last read (detail chapter list). */
  active?: boolean;
  /** Replaces the default category/stats line, e.g. a relative update time. */
  meta?: string;
  metaIcon?: keyof typeof icons;
  /** Shows a trailing chevron when the row opens another screen. */
  chevron?: boolean;
}

function formatCount(n: number | undefined): string | null {
  if (n == null || n <= 0) return null;
  if (n >= 10000) return t('common.wan', {value: (n / 10000).toFixed(1)});
  return String(n);
}

export const AlbumRow = memo(function AlbumRow({
  album,
  onPress,
  onDownload,
  downloading,
  active,
  meta,
  metaIcon,
  chevron,
}: AlbumRowProps) {
  const stats = [formatCount(album.likesCount), formatCount(album.viewsCount)].filter(Boolean);

  return (
    <div
      className={[styles.row, active ? styles.active : ''].filter(Boolean).join(' ')}
      role="button"
      tabIndex={0}
      onClick={() => onPress(album)}
      aria-label={album.name}
    >
      <Poster
        className={styles.poster}
        coverPath={album.coverUrl}
        title={album.name}
        tintIndex={album.albumId}
        fallbackChars={2}
      />
      <div className={styles.body}>
        <span className={[styles.title, hasJapanese(album.name) ? styles.ja : ''].filter(Boolean).join(' ')}>
          {album.name}
        </span>
        {album.author ? (
          <span className={[styles.author, hasJapanese(album.author) ? styles.ja : ''].filter(Boolean).join(' ')}>
            <Icon name="person" size={12} />
            {album.author}
          </span>
        ) : null}
        {meta ? (
          <span className={styles.metaNote}>
            {metaIcon ? <Icon name={metaIcon} size={12} /> : null}
            {meta}
          </span>
        ) : (
          <div className={styles.meta}>
            {album.category ? <span className={styles.chip}>{album.category}</span> : null}
            {album.pageCount ? <span className={styles.stat}>{album.pageCount}P</span> : null}
            {stats.length > 0 ? (
              <span className={styles.stat}>
                <Icon name="favorite" size={12} />
                {stats[0]}
              </span>
            ) : null}
          </div>
        )}
      </div>
      {onDownload ? (
        <button
          type="button"
          className={[styles.action, downloading ? styles.actionActive : ''].filter(Boolean).join(' ')}
          aria-label={downloading ? t('common.queued') : t('common.addDownload')}
          disabled={downloading}
          onClick={(e) => {
            e.stopPropagation();
            if (!downloading) onDownload(album);
          }}
        >
          <Icon name={downloading ? 'download-done' : 'download'} size={20} />
        </button>
      ) : chevron ? (
        <span className={styles.chevron} aria-hidden>
          <Icon name="chevron-right" size={20} />
        </span>
      ) : null}
    </div>
  );
});
