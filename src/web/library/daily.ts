import type {AlbumSummary} from '../../core/model';
import {isLanguageTag} from './tags';

export interface RecommendOptions {
  whitelistTags?: string[];
  excludeIds?: Set<number>;
  /** Dismissed ids the backfill must never release (e.g. this refresh's batch). */
  protectedIds?: Set<number>;
}

/**
 * Three-tier ranking: whitelist hit -> favTag hit -> rest.
 * Language tags never count as matches; dismissed ids are excluded;
 * leftover slots are backfilled from the remaining pool. The pool order
 * (newest first) is preserved so picks advance through days on refresh.
 */
export function buildRecommendations(
  dailyAlbums: AlbumSummary[],
  favTags: string[],
  count = 6,
  options?: RecommendOptions
): AlbumSummary[] {
  if (dailyAlbums.length === 0 || count <= 0) {
    return [];
  }

  const favSet = new Set(favTags.map((t) => t.trim()).filter(Boolean));
  const whitelistSet = new Set((options?.whitelistTags ?? []).map((t) => t.trim()).filter(Boolean));
  const excludeIds = options?.excludeIds ?? new Set<number>();

  const whitelisted: AlbumSummary[] = [];
  const matched: AlbumSummary[] = [];
  const rest: AlbumSummary[] = [];

  const tagHits = (album: AlbumSummary, wanted: Set<string>): boolean =>
    album.tags.some((t) => wanted.has(t) && !isLanguageTag(t));

  for (const album of dailyAlbums) {
    if (excludeIds.has(album.albumId)) continue;
    if (whitelistSet.size > 0 && tagHits(album, whitelistSet)) {
      whitelisted.push(album);
    } else if (favSet.size > 0 && tagHits(album, favSet)) {
      matched.push(album);
    } else {
      rest.push(album);
    }
  }

  const picked: AlbumSummary[] = [];
  const seen = new Set<number>();

  for (const tier of [whitelisted, matched, rest]) {
    for (const album of tier) {
      if (picked.length >= count) break;
      if (seen.has(album.albumId)) continue;
      seen.add(album.albumId);
      picked.push(album);
    }
  }

  return picked;
}

/**
 * Picks recommendations, releasing the oldest dismissed ids when the pool
 * runs short so the grid always backfills toward `count` if possible.
 * Protected ids (the refresh batch) are never released, so a refresh keeps
 * the new picks instead of resurrecting the old ones.
 * Returns the ids that were released from the exclusion set.
 */
export function buildRecommendationsWithBackfill(
  dailyAlbums: AlbumSummary[],
  favTags: string[],
  count = 6,
  options?: RecommendOptions
): {picks: AlbumSummary[]; releasedIds: number[]} {
  const excludeIds = new Set(options?.excludeIds ?? []);
  const protectedIds = options?.protectedIds ?? new Set<number>();
  const released: number[] = [];
  let picks = buildRecommendations(dailyAlbums, favTags, count, {...options, excludeIds});
  while (picks.length < count && excludeIds.size > 0) {
    const releasable = [...excludeIds].filter((id) => !protectedIds.has(id));
    if (releasable.length === 0) break;
    const oldest = releasable[0]!;
    excludeIds.delete(oldest);
    released.push(oldest);
    picks = buildRecommendations(dailyAlbums, favTags, count, {...options, excludeIds});
  }
  return {picks, releasedIds: released};
}

export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** True when the pool still holds enough non-dismissed candidates for a full grid. */
export function hasLocalCandidates(
  albums: AlbumSummary[],
  dismissed: number[],
  count = 6
): boolean {
  const excluded = new Set(dismissed);
  return albums.filter((a) => !excluded.has(a.albumId)).length >= count;
}

/** Accumulate recent albums (newest first) until the recommendation pool is full. */
export function mergeRecentAlbums(pages: AlbumSummary[][], minCount: number): AlbumSummary[] {
  const byId = new Map<number, AlbumSummary>();
  for (const page of pages) {
    for (const album of page) {
      if (album.updateAt != null && !byId.has(album.albumId)) {
        byId.set(album.albumId, album);
      }
    }
    if (byId.size >= minCount) break;
  }
  return [...byId.values()];
}

export function isSameLocalDay(unixSec: number, now = new Date()): boolean {
  const dt = new Date(unixSec * 1000);
  return (
    dt.getFullYear() === now.getFullYear() &&
    dt.getMonth() === now.getMonth() &&
    dt.getDate() === now.getDate()
  );
}
