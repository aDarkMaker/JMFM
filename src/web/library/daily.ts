import type {AlbumSummary} from '../../core/model';
import {isLanguageTag} from './tags';

function shuffleInPlace<T>(arr: T[], random = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export interface RecommendOptions {
  whitelistTags?: string[];
  excludeIds?: Set<number>;
}

/**
 * Three-tier ranking: whitelist hit -> favTag hit -> shuffled rest.
 * Language tags never count as matches; dismissed ids are excluded;
 * leftover slots are backfilled from the remaining pool.
 */
export function buildRecommendations(
  dailyAlbums: AlbumSummary[],
  favTags: string[],
  count = 6,
  random = Math.random,
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

  shuffleInPlace(whitelisted, random);
  shuffleInPlace(matched, random);
  shuffleInPlace(rest, random);

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

export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isSameLocalDay(unixSec: number, now = new Date()): boolean {
  const dt = new Date(unixSec * 1000);
  return (
    dt.getFullYear() === now.getFullYear() &&
    dt.getMonth() === now.getMonth() &&
    dt.getDate() === now.getDate()
  );
}
