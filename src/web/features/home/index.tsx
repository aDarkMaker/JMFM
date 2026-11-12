import {t} from '@/web/i18n';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useShallow} from 'zustand/react/shallow';
import type {AlbumCardData} from '@/web/shared/AlbumCard';
import {AlbumCard} from '@/web/shared/AlbumCard';
import {SectionHeader} from '@/web/ui/SectionHeader';
import {EmptyState} from '@/web/ui/EmptyState';
import {Button} from '@/web/ui/Button';
import {useDailyStore} from '@/web/stores/daily';
import {useLibraryStore} from '@/web/stores/library';
import {useDownloadStore} from '@/web/stores/download';
import {useSettingsStore} from '@/web/stores/settings';
import {useToastStore} from '@/web/stores/toast';
import {useDownloadTask} from '@/web/hooks/useDownloadTask';
import {topTags, rankTagsByFavorites} from '@/web/library/tags';
import {buildRecommendationsWithBackfill} from '@/web/library/daily';
import {filterBlockedAlbums, isBlockedAlbum} from '@/core/model/blocklist';
import {ContinueReading} from '@/web/features/home/ContinueReading';
import {CategoryChips} from '@/web/features/home/CategoryChips';
import {HomeHero} from '@/web/features/home/HomeHero';
import {HomeSearch} from '@/web/features/home/HomeSearch';
import {RankList} from '@/web/features/home/RankList';
import {UpdateList} from '@/web/features/home/UpdateList';
import {AlbumCardSkeleton} from '@/web/shared/Skeletons';
import {useNavStack} from '@/web/hooks/useNavStack';
import gridStyles from './homeGrid.module.css';
import {useBrowseStore} from '@/web/stores/browse';
import {SORT} from '@/core/constants/sort';
import type {ReaderTarget} from '@/web/reader/types';

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
      showToast(t('common.queuedToast', {name: album.title}));
    },
    [queuedIds, blacklistTags, enqueueAlbum, showToast]
  );

  const handleDismiss = useCallback(
    (album: AlbumCardData) => {
      setLeavingIds((prev) => (prev.includes(album.albumId) ? prev : [...prev, album.albumId]));
      const undo = () => {
        void releaseDismissed([album.albumId]);
      };
      showToast(t('home.removed', {title: album.title}), 'info', {label: t('home.undo'), onPress: undo});
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
      showToast(t('home.refreshFailed'), 'error');
    } else {
      showToast(t('home.refreshed'));
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

  const openCard = useCallback(
    (card: AlbumCardData) => pushDetail(card.albumId, card.title),
    [pushDetail]
  );

  const openSearchAlbum = useCallback(
    (id: number, title: string) => pushDetail(id, title),
    [pushDetail]
  );

  const subtitle =
    favTags.length > 0
      ? t('home.favSubtitle', {tags: favTags.join(' / ')})
      : t('home.dailySubtitle');

  return (
    <div className="app-screen">
      <HomeSearch onOpenAlbum={openSearchAlbum} />

      {hero ? <HomeHero album={hero} onPress={openAlbum} /> : null}

      <ContinueReading limit={5} onOpen={onOpenReader} />

      <SectionHeader
        title={t('home.today')}
        subtitle={subtitle}
        actionLabel={t('home.refresh')}
        actionIcon="refresh"
        actionLoading={loading && albums.length > 0}
        onAction={handleRefresh}
      />
      {error && albums.length === 0 ? (
        <div className="app-empty app-empty--fixed">
          <EmptyState icon="cloud-off" title={t('home.recommendFailed')} hint={error} />
          <Button className={gridStyles.retry} onClick={() => void refresh()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : loading && albums.length === 0 ? (
        <AlbumCardSkeleton count={6} />
      ) : recommendations.length === 0 ? (
        <div className="app-empty app-empty--fixed">
          <EmptyState
            icon="photo-library"
            title={t('home.empty')}
            hint={t('home.emptyHint')}
          />
          <Button className={gridStyles.retry} onClick={handleEmptyRefresh}>
            {t('home.refresh')}
          </Button>
        </div>
      ) : (
        <div
          className={[gridStyles.grid, 'grid-cards', loading ? gridStyles.refreshing : '']
            .filter(Boolean)
            .join(' ')}
        >
          {recommendations.map((album) => (
            <AlbumCard
              key={album.albumId}
              album={cardAlbums.get(album.albumId)!}
              onPress={openCard}
              onDownload={handleDownload}
              onDismiss={handleDismiss}
              downloading={queuedIds.has(album.albumId)}
              leaving={leavingIds.includes(album.albumId)}
            />
          ))}
        </div>
      )}

      <SectionHeader
        title={t('home.category')}
        actionLabel={t('home.all')}
        actionIcon="chevron-right"
        onAction={() => pushDiscover()}
      />
      <CategoryChips onPick={(slug) => pushDiscover({category: slug})} />

      {ranked.length > 0 ? (
        <>
          <SectionHeader
            title={t('home.hotRank')}
            subtitle={t('home.weekHot')}
            actionLabel={t('home.more')}
            actionIcon="chevron-right"
            onAction={() => pushDiscover({order: SORT.WEEK_HOT})}
          />
          <RankList albums={ranked} onPress={openAlbum} />
        </>
      ) : null}

      {updates.length > 0 ? (
        <>
          <SectionHeader title={t('home.latestUpdate')} />
          <UpdateList albums={updates} onPress={openAlbum} />
        </>
      ) : null}
    </div>
  );
}
