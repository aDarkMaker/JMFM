import {memo} from 'react';
import {Icon} from './Icon';
import {Poster} from './Poster';
import {hasJapanese} from '../hooks/useJapaneseFont';

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
    album.chapterCount != null ? `${album.chapterCount}话` : null,
    album.pageCount != null ? `${album.pageCount}页` : null,
  ].filter(Boolean);

  return (
    <div
      className={`album-card${leaving ? ' is-leaving' : ''}`}
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
      >
        {tags.length > 0 ? (
          <span className="poster-tag">
            {tags.slice(0, 2).map((tag) => (
              <span className={`album-tag${hasJapanese(tag) ? ' is-ja' : ''}`} key={tag}>
                {tag}
              </span>
            ))}
          </span>
        ) : null}
        {onFavorite ? (
          <button
            className={`album-corner-btn${album.favorite ? ' is-active' : ''}`}
            aria-label="收藏"
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
            className={`album-corner-btn album-corner-download${downloading ? ' is-active' : ''}`}
            aria-label={downloading ? '已在下载队列' : '加入下载'}
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
            className="album-corner-btn album-corner-delete"
            aria-label="删除"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(album);
            }}
          >
            <Icon name="delete" size={16} />
          </button>
        ) : null}
        {onDismiss ? (
          <button
            className="album-corner-btn album-corner-dismiss"
            aria-label="不再推荐"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(album);
            }}
          >
            <Icon name="close" size={16} />
          </button>
        ) : null}
      </Poster>
      {album.progress && album.progress.total > 0 ? (
        <span className="album-progress-track" aria-hidden>
          <span
            className="album-progress-fill"
            style={{
              width: `${Math.min(100, (album.progress.page / album.progress.total) * 100)}%`,
            }}
          />
        </span>
      ) : null}
      <div className="album-info">
        <span className={`album-title${hasJapanese(album.title) ? ' is-ja' : ''}`}>
          {album.title}
        </span>
        {album.author ? (
          <span className={`album-meta${hasJapanese(album.author) ? ' is-ja' : ''}`}>
            {album.author}
          </span>
        ) : null}
        <span className="album-stats">
          <span className="album-stats-id">ID {album.albumId}</span>
          {metaParts.length > 0 ? (
            <span className="album-stats-meta">{metaParts.join('')}</span>
          ) : null}
        </span>
      </div>
    </div>
  );
});
