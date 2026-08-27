import type {AlbumSummary} from '../../core/model';

function shuffleInPlace<T>(arr: T[], random = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Prefer albums whose tags intersect favTags; fill remainder randomly from the rest.
 * When favTags is empty, all slots are filled randomly from dailyAlbums.
 */
export function buildRecommendations(
  dailyAlbums: AlbumSummary[],
  favTags: string[],
  count = 6,
  random = Math.random,
): AlbumSummary[] {
  if (dailyAlbums.length === 0 || count <= 0) {
    return [];
  }

  const favSet = new Set(favTags.map(t => t.trim()).filter(Boolean));
  const matched: AlbumSummary[] = [];
  const rest: AlbumSummary[] = [];

  for (const album of dailyAlbums) {
    const hit =
      favSet.size > 0 &&
      album.tags.some(t => favSet.has(t));
    if (hit) {
      matched.push(album);
    } else {
      rest.push(album);
    }
  }

  shuffleInPlace(matched, random);
  shuffleInPlace(rest, random);

  const picked: AlbumSummary[] = [];
  const seen = new Set<number>();

  for (const album of matched) {
    if (picked.length >= count) break;
    if (seen.has(album.albumId)) continue;
    seen.add(album.albumId);
    picked.push(album);
  }
  for (const album of rest) {
    if (picked.length >= count) break;
    if (seen.has(album.albumId)) continue;
    seen.add(album.albumId);
    picked.push(album);
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
