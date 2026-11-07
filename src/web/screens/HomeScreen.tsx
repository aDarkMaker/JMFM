import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useShallow} from 'zustand/react/shallow';
import {AlbumCard, AlbumCardData} from '../components/AlbumCard';
import {SectionHeader} from '../components/SectionHeader';
import {EmptyState} from '../components/EmptyState';
import {useDailyStore} from '../stores/daily';
import {useLibraryStore} from '../stores/library';
import {useDownloadStore} from '../stores/download';
import {useSettingsStore} from '../stores/settings';
import {useToastStore} from '../stores/toast';
import {useDownloadTask} from '../hooks/useDownloadTask';
import {topTags, rankTagsByFavorites} from '../library/tags';
import {buildRecommendationsWithBackfill} from '../library/daily';
import {filterBlockedAlbums, isBlockedAlbum} from '../../core/model/blocklist';
import {ContinueReading} from '../components/ContinueReading';
import {CategoryChips} from '../components/CategoryChips';
import {HomeHero} from '../components/HomeHero';
import {HomeSearch} from '../components/HomeSearch';
import {RankList} from '../components/RankList';
import {UpdateList} from '../components/UpdateList';
import {AlbumCardSkeleton} from '../components/Skeletons';
import {useNavStack} from '../hooks/useNavStack';
import {useBrowseStore} from '../stores/browse';
import {SORT} from '../../core/constants/sort';
import type {ReaderTarget} from '../reader/types';

const DISMISS_EXIT_MS = 220;
const RANK_LIMIT = 10;
const UPDATE_LIMIT = 12;

export function HomeScreen({onOpenReader}: {onOpenReader: (target: ReaderTarget) => void}) {
  const albums = useDailyStore((s) => s.albums);
  const dismissed = useDailyStore((s) => s.dismissed);
  const loading = useDailyStore((s) => s.loading);
  const error = useDailyStore((s) => s.error);
  const load = useDailyStore((s) => s.load);
  const refresh = useDailyStore((s) => s.refresh);
  const dismiss = useDailyStore((s) => s.dismiss);
  const releaseDismissed = useDailyStore((s) => s.releaseDismissed);
  const resetDismissed = useDailyStore((s) => s.resetDismissed);
  const fetchAlbumTags = useDailyStore((s) => s.fetchAlbumTags);

  const libraryItems = useLibraryStore((s) => s.items);
  // Narrow subscription: only react to albumId membership, so throttled progress updates
  // do not re-render the whole screen.
  const queuedTaskAlbumIds = useDownloadStore(useShallow((s) => s.tasks.map((t) => t.albumId)));
  const blacklistTags = useSettingsStore((s) => s.settings.blacklistTags);
  const whitelistTags = useSettingsStore((s) => s.settings.whitelistTags);
  const {enqueueAlbum} = useDownloadTask();
  const showToast = useToastStore((s) => s.show);
  const {pushDiscover, pushDetail} = useNavStack();
  const hot = useBrowseStore((s) => s.hot);
  const loadHot = useBrowseStore((s) => s.loadHot);
  const loadCategories = useBrowseStore((s) => s.loadCategories);

  const [extraTags, setExtraTags] = useState<Record<number, string[]>>({});
  const [leavingIds, setLeavingIds] = useState<number[]>([]);
  const enrichedRef = useRef<Set<number>>(new Set());

  const favTags = useMemo(() => topTags(libraryItems, 4), [libraryItems]);

  useEffect(() => {
    void load();
    void loadHot();
    void loadCategories();
  }, [load, loadHot, loadCategories]);

  const dismissedSet = useMemo(() => new Set(dismissed), [dismissed]);
  const refreshExclude = useDailyStore((s) => s.refreshExclude);
  const protectedSet = useMemo(() => new Set(refreshExclude), [refreshExclude]);

  const ranked = useMemo(
    () => filterBlockedAlbums(hot, blacklistTags).slice(0, RANK_LIMIT),
    [hot, blacklistTags]
  );

  /** 本周焦点 = 本周热度榜第 1（API `mv_w`）；无榜时退回观看/点赞最高。 */
  const hero = useMemo(() => {
    if (ranked.length > 0) return ranked[0]!;
    if (albums.length === 0) return null;
    return albums.reduce((best, a) => {
      const score = (x: typeof a) => (x.viewsCount ?? 0) * 10 + (x.likesCount ?? 0);
      return score(a) > score(best) ? a : best;
    });
  }, [ranked, albums]);

  const recommendExclude = useMemo(() => {
    const ids = new Set(dismissedSet);
    if (hero) ids.add(hero.albumId);
    return ids;
  }, [dismissedSet, hero]);

  const {picks: rawPicks, releasedIds} = useMemo(
    () =>
      buildRecommendationsWithBackfill(albums, favTags, 6, {
        whitelistTags,
        excludeIds: recommendExclude,
        protectedIds: protectedSet,
      }),
    [albums, favTags, whitelistTags, recommendExclude, protectedSet]
  );

  const recommendations = useMemo(
    () => filterBlockedAlbums(rawPicks, blacklistTags),
    [rawPicks, blacklistTags]
  );

  const updates = useMemo(() => {
    const list = albums.filter((a) => a.updateAt != null);
    return [...list].sort((a, b) => (b.updateAt ?? 0) - (a.updateAt ?? 0)).slice(0, UPDATE_LIMIT);
  }, [albums]);

  // Persist any dismissed ids released to backfill the grid, so picks hold.
  // Skip while loading: the pool expand path re-reads dismissed itself.
  useEffect(() => {
    if (loading) return;
    if (releasedIds.length > 0) {
      void releaseDismissed(releasedIds);
    }
  }, [releasedIds, releaseDismissed, loading]);

  const recommendationIds = useMemo(() => recommendations.map((a) => a.albumId), [recommendations]);

  useEffect(() => {
    // Only albums the pool could not enrich need a detail request; the tag
    // cache dedupes whatever is already known.
    const ids = recommendations
      .filter((a) => (!a.tags || a.tags.length === 0) && !enrichedRef.current.has(a.albumId))
      .map((a) => a.albumId);
    if (ids.length === 0) return;
    void fetchAlbumTags(ids).then((tagsMap) => {
      for (const id of ids) {
        if (tagsMap.has(id)) {
          enrichedRef.current.add(id);
        }
      }
      setExtraTags((prev) => {
        const active = new Set(recommendationIds);
        const next: Record<number, string[]> = {};
        for (const id of recommendationIds) {
          if (prev[id]) {
            next[id] = prev[id]!;
          }
        }
        for (const [id, tags] of tagsMap) {
          next[id] = tags;
        }
        for (const id of Object.keys(prev).map(Number)) {
          if (!active.has(id)) {
            delete next[id];
          }
        }
        return next;
      });
    });
  }, [recommendations, recommendationIds, fetchAlbumTags]);

  const queuedIds = useMemo(() => {
    const ids = new Set(queuedTaskAlbumIds);
    for (const item of libraryItems) {
      ids.add(item.albumId);
    }
    return ids;
  }, [queuedTaskAlbumIds, libraryItems]);

  // Keep card data references stable so AlbumCard memo survives progress updates.
  const cardAlbums = useMemo(() => {
    const map = new Map<number, AlbumCardData>();
    for (const album of recommendations) {
      map.set(album.albumId, {
        albumId: album.albumId,
        title: album.name,
        author: album.author,
        tags: rankTagsByFavorites(
          [...(album.tags ?? []), ...(extraTags[album.albumId] ?? [])],
          favTags
        ),
        coverPath: album.coverUrl,
      });
    }
    return map;
  }, [recommendations, extraTags, favTags]);

  const handleDownload = useCallback(
    (album: AlbumCardData) => {
      if (queuedIds.has(album.albumId)) return;
      if (isBlockedAlbum(album, blacklistTags)) return;
      enqueueAlbum(album.albumId, album.title);
      showToast(`已加入下载队列：${album.title}`);
    },
    [queuedIds, blacklistTags, enqueueAlbum, showToast]
  );

  const handleDismiss = useCallback(
    (album: AlbumCardData) => {
      setLeavingIds((prev) => (prev.includes(album.albumId) ? prev : [...prev, album.albumId]));
      const undo = () => {
        void releaseDismissed([album.albumId]);
      };
      showToast(`已移除：${album.title}`, 'info', {label: '撤销', onPress: undo});
      setTimeout(() => {
        setLeavingIds((prev) => prev.filter((id) => id !== album.albumId));
        void dismiss(album.albumId);
      }, DISMISS_EXIT_MS);
    },
    [releaseDismissed, dismiss, showToast]
  );

  const handleRefresh = useCallback(async () => {
    enrichedRef.current.clear();
    setExtraTags({});
    await refresh(recommendationIds);
    if (useDailyStore.getState().error && useDailyStore.getState().albums.length > 0) {
      showToast('刷新失败，已保留当前推荐', 'error');
    } else {
      showToast('已刷新');
    }
  }, [refresh, recommendationIds, showToast]);

  const handleEmptyRefresh = useCallback(() => {
    if (albums.length > 0 && dismissed.length > 0) {
      void resetDismissed().then(() => refresh());
    } else {
      void refresh();
    }
  }, [albums.length, dismissed.length, resetDismissed, refresh]);

  const openAlbum = useCallback(
    (album: {albumId: number; name: string}) => pushDetail(album.albumId, album.name),
    [pushDetail]
  );

  const subtitle = favTags.length > 0 ? `偏爱 · ${favTags.join(' / ')}` : '每日推荐 · 精选漫画';

  return (
    <div className="app-screen">
      <HomeSearch onOpenAlbum={(id, title) => pushDetail(id, title)} />

      {hero ? <HomeHero album={hero} onPress={openAlbum} /> : null}

      <ContinueReading limit={5} onOpen={onOpenReader} />

      <SectionHeader
        title="今日推荐"
        subtitle={subtitle}
        actionLabel="刷新"
        actionIcon="refresh"
        actionLoading={loading && albums.length > 0}
        onAction={handleRefresh}
      />
      {error && albums.length === 0 ? (
        <div className="app-empty app-empty--fixed">
          <EmptyState icon="cloud-off" title="推荐加载失败" hint={error} />
          <button className="home-retry btn-primary" type="button" onClick={() => void refresh()}>
            重试
          </button>
        </div>
      ) : loading && albums.length === 0 ? (
        <AlbumCardSkeleton count={6} />
      ) : recommendations.length === 0 ? (
        <div className="app-empty app-empty--fixed">
          <EmptyState icon="photo-library" title="暂无今日推荐" hint="稍后再试或刷新换一批" />
          <button className="home-retry btn-primary" type="button" onClick={handleEmptyRefresh}>
            刷新
          </button>
        </div>
      ) : (
        <div className={`home-grid grid-cards${loading ? ' is-refreshing' : ''}`}>
          {recommendations.map((album) => (
            <AlbumCard
              key={album.albumId}
              album={cardAlbums.get(album.albumId)!}
              onPress={(card) => pushDetail(card.albumId, card.title)}
              onDownload={handleDownload}
              onDismiss={handleDismiss}
              downloading={queuedIds.has(album.albumId)}
              leaving={leavingIds.includes(album.albumId)}
            />
          ))}
        </div>
      )}

      <SectionHeader
        title="分类"
        actionLabel="全部"
        actionIcon="chevron-right"
        onAction={() => pushDiscover()}
      />
      <CategoryChips onPick={(slug) => pushDiscover({category: slug})} />

      {ranked.length > 0 ? (
        <>
          <SectionHeader
            title="人气榜"
            subtitle="本周热度"
            actionLabel="更多"
            actionIcon="chevron-right"
            onAction={() => pushDiscover({order: SORT.WEEK_HOT})}
          />
          <RankList albums={ranked} onPress={openAlbum} />
        </>
      ) : null}

      {updates.length > 0 ? (
        <>
          <SectionHeader title="最近更新" />
          <UpdateList albums={updates} onPress={openAlbum} />
        </>
      ) : null}
    </div>
  );
}
