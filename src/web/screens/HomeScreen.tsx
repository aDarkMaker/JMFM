import {dailyRecommendations} from '../../data/mock';
import {AlbumCard} from '../components/AlbumCard';
import {SectionHeader} from '../components/SectionHeader';

export function HomeScreen() {
  return (
    <div className="app-screen">
      <div className="home-hero">
        <span className="home-hero-title">JMFM</span>
        <span className="home-hero-subtitle">每日推荐 · 精选漫画</span>
      </div>
      <SectionHeader title="今日推荐" actionLabel="换一批" actionIcon="refresh" />
      <div className="home-grid">
        {dailyRecommendations.map(album => (
          <AlbumCard key={album.albumId} album={album} />
        ))}
      </div>
    </div>
  );
}
