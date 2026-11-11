import type {AlbumSummary} from '@/core/model';
import styles from './homeHero.module.css';
import {t} from '@/web/i18n';
import {Icon} from '@/web/shared/Icon';
import {Poster} from '@/web/shared/Poster';

export interface HomeHeroProps {
  album: AlbumSummary;
  onPress: (album: AlbumSummary) => void;
}

/** Full-bleed weekly spotlight: cover art plus title and a single meta line. */
export function HomeHero({album, onPress}: HomeHeroProps) {
  const heat =
    album.viewsCount != null && album.viewsCount > 0
      ? album.viewsCount >= 10000
        ? t('home.heroWanViews', {
            value: (album.viewsCount / 10000).toFixed(album.viewsCount >= 100000 ? 0 : 1),
          })
        : t('home.heroViews', {count: album.viewsCount})
      : album.likesCount != null && album.likesCount > 0
        ? album.likesCount >= 10000
          ? t('home.heroWanLikes', {value: (album.likesCount / 10000).toFixed(1)})
          : t('home.heroLikes', {count: album.likesCount})
        : null;
  const meta = [album.author, album.category, heat].filter(Boolean).join(' · ');

  return (
    <button type="button" className={styles.card} onClick={() => onPress(album)}>
      <Poster
        coverPath={album.coverUrl}
        title={album.name}
        tintIndex={album.albumId}
        ratio="fill"
        scrim
        fallbackChars={2}
      />
      <span className={styles.body}>
        <span className={styles.kicker}>
          <Icon name="trending-up" size={14} />
          {t('home.heroKicker')}
        </span>
        <span className={styles.title}>{album.name}</span>
        {meta ? <span className={styles.subtitle}>{meta}</span> : null}
      </span>
    </button>
  );
}
