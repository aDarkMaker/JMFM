import type {AlbumSummary} from '@/core/model';
import type {ApiClient} from '@/core/api';
import {sleep} from '@/core/net';
import {filterBlockedAlbums} from '@/core/model/blocklist';
import {todayKey} from './daily';
import {writeCache, clearStaleCaches} from './dailyCache';
import {fetchAlbumTagsBatch} from './albumTags';

const MAX_PAGES = 12;
/** Pool headroom above dismissed so exclusions and the blacklist filter
 * still leave enough picks for a full grid. */
export const RECOMMEND_POOL_TARGET = 30;
/** Cap for per-album tag backfill in one run; the grid ranks 6 cards and the
 * pool tail is enriched lazily by Home. */
const MAX_DETAIL_FETCH = 12;
const PAGE_SPACING_MS = 400;

export interface DailyFetchOptions {
  blacklistTags: string[];
  whitelistTags: string[];
  favTags: string[];
  dismissedCount: number;
}

/** Fetches pages until the pool holds `minTarget` albums. */
export async function fetchRecentAlbums(
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
    await sleep(PAGE_SPACING_MS);
  }
  return {albums: [...byId.values()], poolPage: MAX_PAGES + 1};
}

/** Fetch deeper pages and append to the existing pool without tag re-enrich. */
export async function expandPool(
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
    await sleep(PAGE_SPACING_MS);
  }
  return {albums: [...byId.values()], poolPage: MAX_PAGES + 1};
}

/** Backfill full tags via detail for pool entries the list response omits. */
export async function fetchMissingTags(
  api: ApiClient,
  albums: AlbumSummary[],
  maxCount = MAX_DETAIL_FETCH
): Promise<AlbumSummary[]> {
  const queue = albums.filter((a) => !a.tags || a.tags.length === 0).slice(0, maxCount);
  if (queue.length === 0) return albums;
  const tagsById = await fetchAlbumTagsBatch(
    api,
    queue.map((a) => a.albumId)
  );
  if (tagsById.size === 0) return albums;
  return albums.map((album) => {
    const tags = tagsById.get(album.albumId);
    return tags && tags.length > 0 ? {...album, tags} : album;
  });
}

/** List responses lack per-album tags; mark preference hits via search ∩ pool. */
export async function enrichTagsBySearch(
  api: ApiClient,
  albums: AlbumSummary[],
  matchTags: string[]
): Promise<AlbumSummary[]> {
  if (albums.length === 0 || matchTags.length === 0) {
    return albums;
  }
  // Detail backfill already covered the enrich cap; searches add nothing.
  if (albums.every((a) => a.tags && a.tags.length > 0)) {
    return albums;
  }

  const poolIds = new Set(albums.map((a) => a.albumId));
  const tagHits = new Map<number, Set<string>>();

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
    await sleep(600);
  }

  if (tagHits.size === 0) {
    return albums;
  }

  return albums.map((album) => {
    const hits = tagHits.get(album.albumId);
    if (!hits || hits.size === 0) return album;
    return {...album, tags: [...new Set([...album.tags, ...hits])]};
  });
}

export interface DailyFetchResult {
  date: string;
  albums: AlbumSummary[];
  poolPage: number;
}

/** Cold-start fetch: recent pool -> tag backfill -> blacklist -> search enrich. */
export async function fetchDailyPool(
  api: ApiClient,
  opts: DailyFetchOptions
): Promise<DailyFetchResult> {
  const date = todayKey();
  await clearStaleCaches(date);
  // Headroom above dismissed so exclusions and the blacklist filter still
  // leave enough candidates for a full 6-card grid.
  const minTarget = opts.dismissedCount + RECOMMEND_POOL_TARGET;
  const {albums: pool, poolPage} = await fetchRecentAlbums(api, minTarget);
  const withTags = await fetchMissingTags(api, pool);
  const raw = filterBlockedAlbums(withTags, opts.blacklistTags);
  const matchTags = [...new Set([...opts.favTags, ...opts.whitelistTags])];
  const albums = await enrichTagsBySearch(api, raw, matchTags);
  writeCache(date, albums);
  return {date, albums, poolPage};
}
