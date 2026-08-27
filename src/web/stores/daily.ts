import {create} from 'zustand';
import type {AlbumSummary} from '../../core/model';
import {ApiClient} from '../../core/api';
import {createHttpClient} from '../../core/net';
import {waitForSettingsLoaded, useSettingsStore} from './settings';
import {waitForLibraryLoaded, useLibraryStore} from './library';
import {topTags} from '../library/tags';
import {filterBlockedAlbums} from '../../core/model/blocklist';
import {isSameLocalDay, todayKey} from '../library/daily';
import {readDismissed, addDismissed, clearDismissed} from '../library/dismissed';
import {readCache, writeCache, clearStaleCaches} from '../library/dailyCache';

const MAX_PAGES = 8;
const PAGE_SIZE_HINT = 80;
const TAG_CACHE_PREFIX = 'jmf.tags.';

function readTagCache(albumId: number): string[] | null {
  try {
    const raw = localStorage.getItem(`${TAG_CACHE_PREFIX}${albumId}`);
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

function writeTagCache(albumId: number, tags: string[]): void {
  try {
    localStorage.setItem(`${TAG_CACHE_PREFIX}${albumId}`, JSON.stringify(tags));
  } catch {
    // ignore
  }
}

async function fetchTagsForAlbum(
  api: ApiClient,
  albumId: number
): Promise<string[] | null> {
  const cached = readTagCache(albumId);
  if (cached) {
    return cached;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const detail = await api.getAlbum(albumId);
      if (detail.tags.length > 0) {
        writeTagCache(albumId, detail.tags);
        return detail.tags;
      }
      return null;
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }
  return null;
}

interface DailyState {
  date: string;
  albums: AlbumSummary[];
  dismissed: number[];
  loading: boolean;
  error?: string;
  load(): Promise<void>;
  refresh(excludeRecommended?: number[]): Promise<void>;
  dismiss(albumId: number): Promise<void>;
  resetDismissed(): Promise<void>;
  fetchAlbumTags(albumIds: number[]): Promise<Map<number, string[]>>;
}

interface DailyOptions {
  proxyEnabled: boolean;
  proxy: string;
  retryTimes: number;
  blacklistTags: string[];
  favTags: string[];
}

function createApi(opts: Pick<DailyOptions, 'proxyEnabled' | 'proxy' | 'retryTimes'>): ApiClient {
  const http = createHttpClient({
    ...(opts.proxyEnabled && opts.proxy ? {proxy: opts.proxy} : {}),
    maxRetries: opts.retryTimes,
  });
  return new ApiClient(http);
}

async function fetchTodayAlbums(api: ApiClient, now = new Date()): Promise<AlbumSummary[]> {
  const byId = new Map<number, AlbumSummary>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const {albums} = await api.getLatestAlbums(page, {order: 'mr_t'});
    if (albums.length === 0) break;

    let todayCount = 0;
    for (const album of albums) {
      if (album.updateAt != null && !isSameLocalDay(album.updateAt, now)) {
        continue;
      }
      todayCount += 1;
      byId.set(album.albumId, album);
    }

    // Full page with no today items → later pages unlikely to be today
    if (todayCount === 0) break;
    // Last page shorter than page size
    if (albums.length < PAGE_SIZE_HINT) break;
    // Space pagination requests to avoid source rate limiting
    await new Promise((r) => setTimeout(r, 400));
  }
  return [...byId.values()];
}

/** Tag list responses lack per-album tags; mark hits via search ∩ today. */
async function enrichTagsBySearch(
  api: ApiClient,
  albums: AlbumSummary[],
  favTags: string[]
): Promise<AlbumSummary[]> {
  if (albums.length === 0 || favTags.length === 0) {
    return albums;
  }

  const todayIds = new Set(albums.map((a) => a.albumId));
  const tagHits = new Map<number, Set<string>>();

  // Search tags serially to avoid source rate limiting
  for (const tag of favTags) {
    try {
      const {albums: found} = await api.searchAlbums(tag, 1);
      for (const item of found) {
        if (!todayIds.has(item.albumId)) continue;
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
    await new Promise((r) => setTimeout(r, 600));
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

async function fetchAndCache(opts: DailyOptions): Promise<{date: string; albums: AlbumSummary[]}> {
  const date = todayKey();
  await clearStaleCaches(date);
  const api = createApi(opts);
  const raw = filterBlockedAlbums(await fetchTodayAlbums(api), opts.blacklistTags);
  const albums = await enrichTagsBySearch(api, raw, opts.favTags);
  writeCache(date, albums);
  return {date, albums};
}

function collectOptions(): DailyOptions {
  const {settings} = useSettingsStore.getState();
  return {
    proxyEnabled: settings.proxyEnabled,
    proxy: settings.proxy,
    retryTimes: settings.retryTimes,
    blacklistTags: settings.blacklistTags,
    favTags: topTags(useLibraryStore.getState().items, 4),
  };
}

export const useDailyStore = create<DailyState>((set, get) => ({
  date: todayKey(),
  albums: [],
  dismissed: [],
  loading: false,
  error: undefined,

  async load() {
    const date = todayKey();
    await clearStaleCaches(date);
    await Promise.all([waitForSettingsLoaded(), waitForLibraryLoaded()]);
    const dismissed = await readDismissed(date);
    const cached = await readCache(date);
    if (cached && cached.length > 0) {
      const {blacklistTags} = collectOptions();
      set({
        date,
        dismissed,
        albums: filterBlockedAlbums(cached, blacklistTags),
        loading: false,
        error: undefined,
      });
      return;
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
      await addDismissed(date, excludeRecommended);
    }
    set({loading: true, error: undefined, date});
    try {
      const result = await fetchAndCache(collectOptions());
      const dismissed = await readDismissed(date);
      set({...result, dismissed, loading: false, error: undefined});
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

  async resetDismissed() {
    const date = todayKey();
    await clearDismissed(date);
    set({dismissed: []});
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
