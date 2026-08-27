import {create} from 'zustand';
import type {AlbumSummary} from '../../core/model';
import {ApiClient} from '../../core/api';
import {createHttpClient} from '../../core/net';
import {useSettingsStore} from './settings';
import {useLibraryStore} from './library';
import {topTags} from '../library/tags';
import {filterBlockedAlbums} from '../../core/model/blocklist';
import {isSameLocalDay, todayKey} from '../library/daily';

const KEY_PREFIX = 'jmf.daily.';
const MAX_PAGES = 8;
const PAGE_SIZE_HINT = 80;

interface DailyCache {
  date: string;
  albums: AlbumSummary[];
}

interface DailyState {
  date: string;
  albums: AlbumSummary[];
  loading: boolean;
  error?: string;
  load(): Promise<void>;
  refresh(): Promise<void>;
}

function cacheKey(date: string): string {
  return `${KEY_PREFIX}${date}`;
}

function readCache(date: string): AlbumSummary[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(date));
    if (!raw) return null;
    const data = JSON.parse(raw) as DailyCache;
    if (data.date !== date || !Array.isArray(data.albums)) return null;
    return data.albums;
  } catch {
    return null;
  }
}

function writeCache(date: string, albums: AlbumSummary[]): void {
  try {
    const payload: DailyCache = {date, albums};
    localStorage.setItem(cacheKey(date), JSON.stringify(payload));
  } catch {
    // ignore quota errors
  }
}

function clearStaleCaches(keepDate: string): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX) && k !== cacheKey(keepDate)) {
        keys.push(k);
      }
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch {
    // ignore
  }
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
    await new Promise(r => setTimeout(r, 400));
  }
  return [...byId.values()];
}

/** Tag list responses lack per-album tags; mark hits via search ∩ today. */
async function enrichTagsBySearch(
  api: ApiClient,
  albums: AlbumSummary[],
  favTags: string[],
): Promise<AlbumSummary[]> {
  if (albums.length === 0 || favTags.length === 0) {
    return albums;
  }

  const todayIds = new Set(albums.map(a => a.albumId));
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
    await new Promise(r => setTimeout(r, 600));
  }

  if (tagHits.size === 0) {
    return albums;
  }

  return albums.map(album => {
    const hits = tagHits.get(album.albumId);
    if (!hits || hits.size === 0) return album;
    const merged = new Set([...album.tags, ...hits]);
    return {...album, tags: [...merged]};
  });
}

async function fetchAndCache(opts: DailyOptions): Promise<{date: string; albums: AlbumSummary[]}> {
  const date = todayKey();
  clearStaleCaches(date);
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
  loading: false,
  error: undefined,

  async load() {
    const date = todayKey();
    clearStaleCaches(date);
    const cached = readCache(date);
    if (cached && cached.length > 0) {
      const {blacklistTags} = collectOptions();
      set({
        date,
        albums: filterBlockedAlbums(cached, blacklistTags),
        loading: false,
        error: undefined,
      });
      return;
    }
    if (get().loading) return;
    set({loading: true, error: undefined, date});
    try {
      const result = await fetchAndCache(collectOptions());
      set({...result, loading: false, error: undefined});
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  async refresh() {
    if (get().loading) return;
    const date = todayKey();
    set({loading: true, error: undefined, date});
    try {
      const result = await fetchAndCache(collectOptions());
      set({...result, loading: false, error: undefined});
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
}));
