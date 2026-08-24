import {memo, useEffect, useState} from 'react';
import {Icon} from './Icon';
import {useCoverSrc} from '../hooks/useCoverSrc';
import {hasJapanese} from '../hooks/useJapaneseFont';
import {useOverflowFade} from '../hooks/useOverflowFade';

export interface AlbumCardData {
  albumId: number;
  title: string;
  author?: string;
  tags?: string[];
  chapterCount?: number;
  pageCount?: number;
  coverColor?: string;
  coverPath?: string;
  favorite?: boolean;
}

export interface AlbumCardProps {
  album: AlbumCardData;
  onPress?: (album: AlbumCardData) => void;
  onFavorite?: (album: AlbumCardData) => void;
  onDelete?: (album: AlbumCardData) => void;
}

const COVER_PALETTE = ['#e8d5c0', '#d0dbe8', '#e8d0c8', '#c8d8e0', '#e8d8d0', '#d8e0c8'];

function coverColorOf(albumId: number): string {
  return COVER_PALETTE[albumId % COVER_PALETTE.length];
}

export const AlbumCard = memo(function AlbumCard({
  album,
  onPress,
  onFavorite,
  onDelete,
}: AlbumCardProps) {
  const coverSrc = useCoverSrc(album.coverPath);
  const [imgFailed, setImgFailed] = useState(false);
  const {ref: tagsRef, overflow: tagsOverflow} = useOverflowFade<HTMLDivElement>();

  useEffect(() => {
    setImgFailed(false);
  }, [album.albumId]);

  const tags = album.tags ?? [];
  const showCover = coverSrc !== null && !imgFailed;

  return (
    <div
      className="album-card"
      role="button"
      tabIndex={0}
      onClick={() => onPress?.(album)}
      aria-label={album.title}
    >
      <div className="album-cover" style={{background: album.coverColor ?? coverColorOf(album.albumId)}}>
        {showCover ? (
          <img
            className="album-cover-img"
            src={coverSrc ?? undefined}
            alt={album.title}
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="cover-title">{album.title.slice(0, 4)}</span>
        )}
        {onFavorite ? (
          <button
            className={`album-corner-btn${album.favorite ? ' is-active' : ''}`}
            aria-label="收藏"
            onClick={e => {
              e.stopPropagation();
              onFavorite(album);
            }}
          >
            <Icon name="favorite" size={16} />
          </button>
        ) : null}
        {onDelete ? (
          <button
            className="album-corner-btn album-corner-delete"
            aria-label="删除"
            onClick={e => {
              e.stopPropagation();
              onDelete(album);
            }}
          >
            <Icon name="delete" size={16} />
          </button>
        ) : null}
      </div>
      <div className="album-info">
        <span className={`album-title${hasJapanese(album.title) ? ' is-ja' : ''}`}>{album.title}</span>
        {album.author ? (
          <span className={`album-meta${hasJapanese(album.author) ? ' is-ja' : ''}`}>{album.author}</span>
        ) : null}
        {tags.length > 0 ? (
          <div className="album-tags">
            <div
              ref={tagsRef}
              className={`album-tags-fade${tagsOverflow ? ' is-overflow' : ''}`}
            >
              {tags.map(tag => (
                <span className={`album-tag${hasJapanese(tag) ? ' is-ja' : ''}`} key={tag}>{tag}</span>
              ))}
            </div>
            {tagsOverflow ? <span className="album-tags-more">…</span> : null}
          </div>
        ) : null}
        <span className="album-stats">
          <span>ID {album.albumId}</span>
          {album.chapterCount ? <span>{album.chapterCount}话</span> : null}
          {album.pageCount ? <span>{album.pageCount}页</span> : null}
        </span>
      </div>
    </div>
  );
});
