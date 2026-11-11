import {create} from 'zustand';
import type {AlbumSummary} from '@/core/model';
import {createApi} from '@/web/api/createApi';
import {waitForSettingsLoaded, useSettingsStore} from './settings';
import {waitForLibraryLoaded, useLibraryStore} from './library';
import {topTags} from '@/web/library/tags';
import {filterBlockedAlbums} from '@/core/model/blocklist';
import {todayKey, hasLocalCandidates} from '@/web/library/daily';
import {readDismissed, addDismissed, removeDismissed, clearDismissed} from '@/web/library/dismissed';
import {readCache, clearStaleCaches} from '@/web/library/dailyCache';
import {fetchAlbumTagsBatch} from '@/web/library/albumTags';
import {RECOMMEND_POOL_TARGET, expandPool, fetchDailyPool, type DailyFetchOptions} from '@/web/library/dailyFetch';

interface DailyState {
  date: string;
  albums: AlbumSummary[];
  dismissed: number[];
  /** Ids excluded by the most recent refresh; the backfill never releases them. */
  refreshExclude: number[];
  /** Next getLatestAlbums page to fetch when the pool needs expansion. */
  poolPage: number;
  loading: boolean;
  error?: string;
  load(): Promise<void>;
  refresh(excludeRecommended?: number[]): Promise<void>;
  dismiss(albumId: number): Promise<void>;
  releaseDismissed(albumIds: number[]): Promise<void>;
  resetDismissed(): Promise<void>;
  fetchAlbumTags(albumIds: number[]): Promise<Map<number, string[]>>;
}

function collectOptions(): DailyFetchOptions {
  const {settings} = useSettingsStore.getState();
  const {dismissed} = useDailyStore.getState();
  return {
    blacklistTags: settings.blacklistTags,
    whitelistTags: settings.whitelistTags,
    favTags: topTags(useLibraryStore.getState().items, 4),
    dismissedCount: dismissed.length,
  };
}

export const useDailyStore = create<DailyState>((set, get) => ({
  date: todayKey(),
  albums: [],
  dismissed: [],
  refreshExclude: [],
  poolPage: 1,
  loading: false,
  error: undefined,

  async load() {
    const date = todayKey();
    // Keep the loaded page across tab switches; only reload when the day changes.
    if (get().albums.length > 0 && get().date === date) {
      return;
    }
    await clearStaleCaches(date);
    await Promise.all([waitForSettingsLoaded(), waitForLibraryLoaded()]);
    const dismissed = await readDismissed(date);
    const cached = await readCache(date);
    if (cached && cached.length > 0) {
      const {blacklistTags} = collectOptions();
      const kept = filterBlockedAlbums(cached, blacklistTags);
      const excluded = new Set(dismissed);
      // Stale caches can run out of candidates after many dismisses; refetch
      // a deeper pool instead of showing a near-empty grid.
      if (kept.some((a) => !excluded.has(a.albumId))) {
        set({
          date,
          dismissed,
          albums: kept,
          poolPage: 1,
          loading: false,
          error: undefined,
        });
        return;
      }
    }
    if (get().loading) return;
    set({loading: true, error: undefined, date, dismissed});
    try {
      const result = await fetchDailyPool(createApi(), collectOptions());
      set({...result, dismissed, loading: false, error: undefined});
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  async refresh(excludeRecommended) {
    if (get().loading) return;
    const date = todayKey();
    await Promise.all([waitForSettingsLoaded(), waitForLibraryLoaded()]);
    if (excludeRecommended && excludeRecommended.length > 0) {
      const merged = [...new Set([...get().dismissed, ...excludeRecommended])];
      set({dismissed: merged, refreshExclude: excludeRecommended});
      await addDismissed(date, excludeRecommended);
    } else {
      set({refreshExclude: []});
    }
    // The pool still holds enough candidates: swap the grid locally with no
    // network and no grey state, so a refresh never looks stuck.
    if (hasLocalCandidates(get().albums, get().dismissed)) {
      set({date, loading: false, error: undefined});
      return;
    }
    // Pool runs short: fetch deeper pages and append, then the grid backfills.
    set({loading: true, error: undefined, date});
    try {
      const {settings} = useSettingsStore.getState();
      const {albums, poolPage} = await expandPool(
        createApi(),
        get().albums,
        get().poolPage,
        get().albums.length + RECOMMEND_POOL_TARGET
      );
      const dismissed = await readDismissed(date);
      set({
        albums: filterBlockedAlbums(albums, settings.blacklistTags),
        poolPage,
        dismissed,
        loading: false,
        error: undefined,
      });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  async dismiss(albumId) {
    const date = get().date;
    const dismissed = [...get().dismissed, albumId];
    set({dismissed});
    await addDismissed(date, [albumId]);
  },

  async releaseDismissed(albumIds) {
    if (albumIds.length === 0) return;
    const date = get().date;
    await removeDismissed(date, albumIds);
    const dismissed = await readDismissed(date);
    set({dismissed});
  },

  async resetDismissed() {
    const date = todayKey();
    await clearDismissed(date);
    set({dismissed: [], refreshExclude: []});
  },

  async fetchAlbumTags(albumIds) {
    return fetchAlbumTagsBatch(createApi(), albumIds);
  },
}));

// Re-filter cached results whenever the blacklist changes
useSettingsStore.subscribe((state, prev) => {
  if (!state.loaded || !prev.loaded) return;
  if (state.settings.blacklistTags === prev.settings.blacklistTags) return;
  const {albums} = useDailyStore.getState();
  if (albums.length === 0) return;
  useDailyStore.setState({
    albums: filterBlockedAlbums(albums, state.settings.blacklistTags),
  });
});
