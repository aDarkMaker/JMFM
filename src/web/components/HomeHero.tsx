import type {AlbumSummary} from '../../core/model';
import {Icon} from './Icon';
import {Poster} from './Poster';

export interface HomeHeroProps {
  album: AlbumSummary;
  onPress: (album: AlbumSummary) => void;
}

/** Full-bleed weekly spotlight: cover art plus title and a single meta line. */
export function HomeHero({album, onPress}: HomeHeroProps) {
  const heat =
    album.viewsCount != null && album.viewsCount > 0
      ? album.viewsCount >= 10000
        ? `${(album.viewsCount / 10000).toFixed(album.viewsCount >= 100000 ? 0 : 1)}万 观看`
        : `${album.viewsCount} 观看`
      : album.likesCount != null && album.likesCount > 0
        ? album.likesCount >= 10000
          ? `${(album.likesCount / 10000).toFixed(1)}万 喜欢`
          : `${album.likesCount} 喜欢`
        : null;
  const meta = [album.author, album.category, heat].filter(Boolean).join(' · ');

  return (
    <button className="home-hero-card" onClick={() => onPress(album)}>
      <Poster
        coverPath={album.coverUrl}
        title={album.name}
        tintIndex={album.albumId}
        ratio="fill"
        scrim
        fallbackChars={2}
      />
      <span className="home-hero-body">
        <span className="home-hero-kicker">
          <Icon name="trending-up" size={14} />
          本周焦点
        </span>
        <span className="home-hero-title">{album.name}</span>
        {meta ? <span className="home-hero-subtitle">{meta}</span> : null}
      </span>
    </button>
  );
}
