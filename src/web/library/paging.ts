import type {AlbumSummary} from '@/core/model';

/** API pages are ~80 items; a short page means the feed ended. */
export const FEED_PAGE_SIZE = 80;

export interface FeedPage {
  albums: AlbumSummary[];
  total: number;
}

/** Appends a page while dropping duplicates the source sometimes repeats. */
export function appendPage(existing: AlbumSummary[], next: AlbumSummary[]): AlbumSummary[] {
  if (existing.length === 0) {
    return dedupe(next);
  }
  const seen = new Set(existing.map((a) => a.albumId));
  const merged = [...existing];
  for (const album of next) {
    if (seen.has(album.albumId)) continue;
    seen.add(album.albumId);
    merged.push(album);
  }
  return merged;
}

export function dedupe(albums: AlbumSummary[]): AlbumSummary[] {
  const seen = new Set<number>();
  const out: AlbumSummary[] = [];
  for (const album of albums) {
    if (seen.has(album.albumId)) continue;
    seen.add(album.albumId);
    out.push(album);
  }
  return out;
}

/** Short pages, empty responses, or reaching `total` all mean no more pages. */
export function reachedEnd(page: FeedPage, pageIndex: number): boolean {
  if (page.albums.length === 0) return true;
  if (page.albums.length < FEED_PAGE_SIZE) return true;
  if (page.total > 0 && pageIndex * FEED_PAGE_SIZE >= page.total) return true;
  return false;
}

export function feedKey(parts: (string | undefined)[]): string {
  return parts.map((p) => p ?? '').join('|');
}
