import type {AlbumSummary} from '@/core/model';
import styles from './rankList.module.css';
import {t} from '@/web/i18n';
import {Icon} from '@/web/shared/Icon';
import {Poster} from '@/web/shared/Poster';

export interface RankListProps {
  albums: AlbumSummary[];
  onPress: (album: AlbumSummary) => void;
}

function formatCount(n: number | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  if (n >= 100_000_000) return t('common.yi', {value: (n / 100_000_000).toFixed(1)});
  if (n >= 10_000) return t('common.wan', {value: (n / 10_000).toFixed(n >= 100_000 ? 0 : 1)});
  return String(n);
}

function rankTone(index: number): string {
  if (index === 0) return [styles.indexTop, styles.indexGold].join(' ');
  if (index === 1) return [styles.indexTop, styles.indexSilver].join(' ');
  if (index === 2) return [styles.indexTop, styles.indexBronze].join(' ');
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
    <div className={styles.list}>
      {albums.map((album, index) => {
        const views = formatCount(album.viewsCount);
        const likes = formatCount(album.likesCount);
        const pending = album.viewsCount == null && album.likesCount == null;
        return (
          <button
            type="button"
            key={album.albumId}
            className={styles.item}
            onClick={() => onPress(album)}
          >
            <span className={[styles.index, rankTone(index)].filter(Boolean).join(' ')}>{index + 1}</span>
            <Poster
              className={styles.poster}
              coverPath={album.coverUrl}
              title={album.name}
              tintIndex={album.albumId}
              ratio="1/1"
              fallbackChars={1}
            />
            <span className={styles.body}>
              <span className={styles.title}>{album.name}</span>
              <span className={styles.meta}>{metaLine(album)}</span>
            </span>
            <span className={[styles.stat, pending ? styles.statPending : ''].filter(Boolean).join(' ')}>
              <span className={styles.statRow} title={t('common.views')}>
                <Icon name="trending-up" size={12} />
                <span className={styles.statNum}>{views}</span>
              </span>
              <span className={[styles.statRow, styles.statRowLikes].join(' ')} title={t('common.likes')}>
                <Icon name="favorite" size={11} />
                <span className={styles.statNum}>{likes}</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
