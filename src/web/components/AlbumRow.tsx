import {memo} from 'react';
import type {AlbumSummary} from '../../core/model';
import {icons} from '../generated/icons';
import {Icon} from './Icon';
import {Poster} from './Poster';
import {hasJapanese} from '../hooks/useJapaneseFont';

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
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
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
      className={`album-row${active ? ' is-active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onPress(album)}
      aria-label={album.name}
    >
      <Poster
        className="album-row-poster"
        coverPath={album.coverUrl}
        title={album.name}
        tintIndex={album.albumId}
        fallbackChars={2}
      />
      <div className="album-row-body">
        <span className={`album-row-title${hasJapanese(album.name) ? ' is-ja' : ''}`}>
          {album.name}
        </span>
        {album.author ? (
          <span className={`album-row-author${hasJapanese(album.author) ? ' is-ja' : ''}`}>
            <Icon name="person" size={12} />
            {album.author}
          </span>
        ) : null}
        {meta ? (
          <span className="album-row-meta-note">
            {metaIcon ? <Icon name={metaIcon} size={12} /> : null}
            {meta}
          </span>
        ) : (
          <div className="album-row-meta">
            {album.category ? <span className="album-row-chip">{album.category}</span> : null}
            {album.pageCount ? <span className="album-row-stat">{album.pageCount}P</span> : null}
            {stats.length > 0 ? (
              <span className="album-row-stat">
                <Icon name="favorite" size={12} />
                {stats[0]}
              </span>
            ) : null}
          </div>
        )}
      </div>
      {onDownload ? (
        <button
          className={`album-row-action${downloading ? ' is-active' : ''}`}
          aria-label={downloading ? '已在下载队列' : '加入下载'}
          disabled={downloading}
          onClick={(e) => {
            e.stopPropagation();
            if (!downloading) onDownload(album);
          }}
        >
          <Icon name={downloading ? 'download-done' : 'download'} size={20} />
        </button>
      ) : chevron ? (
        <span className="album-row-chevron" aria-hidden>
          <Icon name="chevron-right" size={20} />
        </span>
      ) : null}
    </div>
  );
});
