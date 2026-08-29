import {create} from 'zustand';
import type {AlbumSummary} from '../../core/model';
import {ApiClient} from '../../core/api';
import {createHttpClient, sleep} from '../../core/net';
import {waitForSettingsLoaded, useSettingsStore} from './settings';
import {waitForLibraryLoaded, useLibraryStore} from './library';
import {topTags} from '../library/tags';
import {filterBlockedAlbums} from '../../core/model/blocklist';
import {todayKey, hasLocalCandidates} from '../library/daily';
import {createUserStorage} from '../../data/user-storage';
import {STORAGE_KEYS} from '../../data/storage-keys';
import {readDismissed, addDismissed, removeDismissed, clearDismissed} from '../library/dismissed';
import {readCache, writeCache, clearStaleCaches} from '../library/dailyCache';

const MAX_PAGES = 12;
/** Pool headroom above dismissed so exclusions and the blacklist filter
 * still leave enough picks for a full grid. */
const RECOMMEND_POOL_TARGET = 30;
/** Cap for per-album tag backfill in one fetchAndCache run. */
const MAX_DETAIL_FETCH = 30;
const DETAIL_FETCH_CONCURRENCY = 3;
const storage = createUserStorage();

async function readTagCache(albumId: number): Promise<string[] | null> {
  try {
    const raw = await storage.get(`${STORAGE_KEYS.tagCachePrefix}${albumId}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    const tags = parsed.map(String).filter(Boolean);
    return tags.length > 0 ? tags : null;
  } catch {
    return null;
  }
}

async function writeTagCache(albumId: number, tags: string[]): Promise<void> {
  try {
    await storage.set(`${STORAGE_KEYS.tagCachePrefix}${albumId}`, JSON.stringify(tags));
  } catch {
    // ignore
  }
}

async function fetchTagsForAlbum(
  api: ApiClient,
  albumId: number
): Promise<string[] | null> {
  const cached = await readTagCache(albumId);
  if (cached) {
    return cached;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const detail = await api.getAlbum(albumId);
      if (detail.tags.length > 0) {
        await writeTagCache(albumId, detail.tags);
        return detail.tags;
      }
      return null;
    } catch {
      if (attempt === 0) {
        await sleep(400);
      }
    }
  }
  return null;
}

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

interface DailyOptions {
  proxyEnabled: boolean;
  proxy: string;
  retryTimes: number;
  blacklistTags: string[];
  whitelistTags: string[];
  favTags: string[];
  dismissedCount: number;
}

function createApi(opts: Pick<DailyOptions, 'proxyEnabled' | 'proxy' | 'retryTimes'>): ApiClient {
  const http = createHttpClient({
    ...(opts.proxyEnabled && opts.proxy ? {proxy: opts.proxy} : {}),
    maxRetries: opts.retryTimes,
  });
  return new ApiClient(http);
}

async function fetchRecentAlbums(
  api: ApiClient,
  minTarget: number
): Promise<{albums: AlbumSummary[]; poolPage: number}> {
  const byId = new Map<number, AlbumSummary>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const {albums} = await api.getLatestAlbums(page, {order: 'mr_t'});
    // Rate limiting shrinks pages below the usual size, so only a truly empty
    // page marks the end; keep paging until the target is met or MAX_PAGES.
    if (albums.length === 0) {
      return {albums: [...byId.values()], poolPage: page};
    }
    for (const album of albums) {
      if (album.updateAt != null && !byId.has(album.albumId)) {
        byId.set(album.albumId, album);
      }
    }
    if (byId.size >= minTarget) {
      return {albums: [...byId.values()], poolPage: page + 1};
    }
    // Space pagination requests to avoid source rate limiting
    await sleep(400);
  }
  return {albums: [...byId.values()], poolPage: MAX_PAGES + 1};
}

/** Fetch deeper pages and append to the existing pool without tag re-enrich. */
async function expandPool(
  api: ApiClient,
  existing: AlbumSummary[],
  fromPage: number,
  minTarget: number
): Promise<{albums: AlbumSummary[]; poolPage: number}> {
  const byId = new Map(existing.map((a) => [a.albumId, a]));
  for (let page = fromPage; page <= MAX_PAGES; page++) {
    const {albums} = await api.getLatestAlbums(page, {order: 'mr_t'});
    if (albums.length === 0) {
      return {albums: [...byId.values()], poolPage: page};
    }
    for (const album of albums) {
      if (album.updateAt != null && !byId.has(album.albumId)) {
        byId.set(album.albumId, album);
      }
    }
    if (byId.size >= minTarget) {
      return {albums: [...byId.values()], poolPage: page + 1};
    }
    // Space pagination requests to avoid source rate limiting
    await sleep(400);
  }
  return {albums: [...byId.values()], poolPage: MAX_PAGES + 1};
}

/** Backfill full tags via detail for pool entries the list response omits. */
async function fetchMissingTags(
  api: ApiClient,
  albums: AlbumSummary[],
  maxCount = MAX_DETAIL_FETCH
): Promise<AlbumSummary[]> {
  const byId = new Map(albums.map((a) => [a.albumId, a]));
  const queue = albums.filter((a) => !a.tags || a.tags.length === 0).slice(0, maxCount);
  const workers = Array.from(
    {length: Math.min(DETAIL_FETCH_CONCURRENCY, queue.length)},
    async () => {
      for (;;) {
        const album = queue.shift();
        if (!album) break;
        const tags = await fetchTagsForAlbum(api, album.albumId);
        if (tags && tags.length > 0) {
          const current = byId.get(album.albumId);
          if (current) {
            byId.set(album.albumId, {...current, tags});
          }
        }
      }
    }
  );
  await Promise.all(workers);
  return [...byId.values()];
}

/** List responses lack per-album tags; mark preference hits via search ∩ pool. */
async function enrichTagsBySearch(
  api: ApiClient,
  albums: AlbumSummary[],
  matchTags: string[]
): Promise<AlbumSummary[]> {
  if (albums.length === 0 || matchTags.length === 0) {
    return albums;
  }
  // Detail backfill already covered every album; searches add nothing.
  if (albums.every((a) => a.tags && a.tags.length > 0)) {
    return albums;
  }

  const poolIds = new Set(albums.map((a) => a.albumId));
  const tagHits = new Map<number, Set<string>>();

  // Search tags serially to avoid source rate limiting
  for (const tag of matchTags) {
    try {
      const {albums: found} = await api.searchAlbums(tag, 1);
      for (const item of found) {
        if (!poolIds.has(item.albumId)) continue;
        let set = tagHits.get(item.albumId);
        if (!set) {
          set = new Set();
          tagHits.set(item.albumId, set);
        }
        set.add(tag);
      }
    } catch {
      // ignore single-tag search failure
    }
    // Space search requests to avoid source rate limiting
    await sleep(600);
  }

  if (tagHits.size === 0) {
    return albums;
  }

  return albums.map((album) => {
    const hits = tagHits.get(album.albumId);
    if (!hits || hits.size === 0) return album;
    const merged = new Set([...album.tags, ...hits]);
    return {...album, tags: [...merged]};
  });
}

async function fetchAndCache(
  opts: DailyOptions
): Promise<{date: string; albums: AlbumSummary[]; poolPage: number}> {
  const date = todayKey();
  await clearStaleCaches(date);
  const api = createApi(opts);
  // Headroom = RECOMMEND_POOL_TARGET above dismissed, so exclusions plus the
  // blacklist filter still leave enough candidates for a full 6-card grid.
  const minTarget = opts.dismissedCount + RECOMMEND_POOL_TARGET;
  const {albums: pool, poolPage} = await fetchRecentAlbums(api, minTarget);
  const withTags = await fetchMissingTags(api, pool);
  const raw = filterBlockedAlbums(withTags, opts.blacklistTags);
  const matchTags = [...new Set([...opts.favTags, ...opts.whitelistTags])];
  const albums = await enrichTagsBySearch(api, raw, matchTags);
  writeCache(date, albums);
  return {date, albums, poolPage};
}

function collectOptions(): DailyOptions {
  const {settings} = useSettingsStore.getState();
  const {dismissed} = useDailyStore.getState();
  return {
    proxyEnabled: settings.proxyEnabled,
    proxy: settings.proxy,
    retryTimes: settings.retryTimes,
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
      const result = await fetchAndCache(collectOptions());
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
      const api = createApi({
        proxyEnabled: settings.proxyEnabled,
        proxy: settings.proxy,
        retryTimes: settings.retryTimes,
      });
      const {albums, poolPage} = await expandPool(
        api,
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
    const {settings} = useSettingsStore.getState();
    const api = createApi({
      proxyEnabled: settings.proxyEnabled,
      proxy: settings.proxy,
      retryTimes: settings.retryTimes,
    });
    const result = new Map<number, string[]>();
    for (const id of albumIds) {
      const tags = await fetchTagsForAlbum(api, id);
      if (tags) {
        result.set(id, tags);
      }
    }
    return result;
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
