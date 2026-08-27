import {useCallback, useEffect, useMemo} from 'react';
import {AlbumCard, AlbumCardData} from '../components/AlbumCard';
import {SectionHeader} from '../components/SectionHeader';
import {EmptyState} from '../components/EmptyState';
import {useDailyStore} from '../stores/daily';
import {useLibraryStore} from '../stores/library';
import {useDownloadStore} from '../stores/download';
import {useSettingsStore} from '../stores/settings';
import {useDownloadTask} from '../hooks/useDownloadTask';
import {topTags} from '../library/tags';
import {buildRecommendations} from '../library/daily';
import {filterBlockedAlbums, isBlockedAlbum} from '../../core/model/blocklist';

export function HomeScreen() {
  const albums = useDailyStore(s => s.albums);
  const loading = useDailyStore(s => s.loading);
  const error = useDailyStore(s => s.error);
  const load = useDailyStore(s => s.load);
  const refresh = useDailyStore(s => s.refresh);

  const libraryItems = useLibraryStore(s => s.items);
  const tasks = useDownloadStore(s => s.tasks);
  const blacklistTags = useSettingsStore(s => s.settings.blacklistTags);
  const {enqueueAlbum} = useDownloadTask();

  const favTags = useMemo(() => topTags(libraryItems, 4), [libraryItems]);

  useEffect(() => {
    void load();
  }, [load]);

  const recommendations = useMemo(
    () =>
      filterBlockedAlbums(buildRecommendations(albums, favTags, 6), blacklistTags),
    [albums, favTags, blacklistTags],
  );

  const queuedIds = useMemo(() => {
    const ids = new Set(tasks.map(t => t.albumId));
    for (const item of libraryItems) {
      ids.add(item.albumId);
    }
    return ids;
  }, [tasks, libraryItems]);

  const handleDownload = useCallback(
    (album: AlbumCardData) => {
      if (queuedIds.has(album.albumId)) return;
      if (isBlockedAlbum(album, blacklistTags)) return;
      enqueueAlbum(album.albumId, album.title);
    },
    [queuedIds, blacklistTags, enqueueAlbum],
  );

  const subtitle =
    favTags.length > 0
      ? `偏爱 · ${favTags.join(' / ')}`
      : '每日推荐 · 精选漫画';

  return (
    <div className="app-screen">
      <div className="home-hero">
        <span className="home-hero-title">JMFM</span>
        <span className="home-hero-subtitle">{subtitle}</span>
      </div>
      <SectionHeader title="今日推荐" />
      {error && albums.length === 0 ? (
        <div className="app-empty">
          <EmptyState
            icon="cloud-off"
            title="推荐加载失败"
            hint={error}
          />
          <button className="home-retry" type="button" onClick={() => void refresh()}>
            重试
          </button>
        </div>
      ) : loading && albums.length === 0 ? (
        <div className="app-empty">
          <EmptyState icon="cloud-download" title="正在拉取今日漫画" hint="仅缓存元数据与封面" />
        </div>
      ) : recommendations.length === 0 ? (
        <div className="app-empty">
          <EmptyState icon="photo-library" title="暂无今日推荐" hint="稍后再试或下拉刷新" />
          <button className="home-retry" type="button" onClick={() => void refresh()}>
            刷新
          </button>
        </div>
      ) : (
        <div className="home-grid">
          {recommendations.map(album => (
            <AlbumCard
              key={album.albumId}
              album={{
                albumId: album.albumId,
                title: album.name,
                author: album.author,
                tags: album.tags,
                coverPath: album.coverUrl,
              }}
              onDownload={handleDownload}
              downloading={queuedIds.has(album.albumId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
