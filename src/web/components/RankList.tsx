import type {AlbumSummary} from '../../core/model';
import {Icon} from './Icon';
import {Poster} from './Poster';

export interface RankListProps {
  albums: AlbumSummary[];
  onPress: (album: AlbumSummary) => void;
}

function formatCount(n: number | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(n >= 100_000 ? 0 : 1)}万`;
  return String(n);
}

function rankTone(index: number): string {
  if (index === 0) return ' is-top is-gold';
  if (index === 1) return ' is-top is-silver';
  if (index === 2) return ' is-top is-bronze';
  return '';
}

function metaLine(album: AlbumSummary): string {
  const author = album.author?.trim();
  const category = album.category?.trim();
  if (category && author) return `${category} · ${author}`;
  return category || author || '—';
}

/** Compact Top-N list. Order is API week-hot; stats hydrated from /album. */
export function RankList({albums, onPress}: RankListProps) {
  if (albums.length === 0) return null;

  return (
    <div className="rank-list">
      {albums.map((album, index) => {
        const views = formatCount(album.viewsCount);
        const likes = formatCount(album.likesCount);
        const pending = album.viewsCount == null && album.likesCount == null;
        return (
          <button key={album.albumId} className="rank-item" onClick={() => onPress(album)}>
            <span className={`rank-index${rankTone(index)}`}>{index + 1}</span>
            <Poster
              className="rank-poster"
              coverPath={album.coverUrl}
              title={album.name}
              tintIndex={album.albumId}
              ratio="1/1"
              fallbackChars={1}
            />
            <span className="rank-body">
              <span className="rank-title">{album.name}</span>
              <span className="rank-meta">{metaLine(album)}</span>
            </span>
            <span className={`rank-stat${pending ? ' is-pending' : ''}`}>
              <span className="rank-stat-row" title="观看">
                <Icon name="trending-up" size={12} />
                <span className="rank-stat-num">{views}</span>
              </span>
              <span className="rank-stat-row is-likes" title="喜欢">
                <Icon name="favorite" size={11} />
                <span className="rank-stat-num">{likes}</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
