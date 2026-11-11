import type {ApiClient} from '@/core/api';
import {sleep} from '@/core/net';
import {createUserStorage} from '@/data/user-storage';
import {STORAGE_KEYS} from '@/data/storage-keys';

export const DETAIL_FETCH_CONCURRENCY = 3;

const storage = createUserStorage();
const memory = new Map<number, string[]>();
const inflight = new Map<number, Promise<string[] | null>>();

function tagKey(albumId: number): string {
  return `${STORAGE_KEYS.tagCachePrefix}${albumId}`;
}

async function readDisk(albumId: number): Promise<string[] | null> {
  try {
    const raw = await storage.get(tagKey(albumId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const tags = parsed.map(String).filter(Boolean);
    return tags.length > 0 ? tags : null;
  } catch {
    return null;
  }
}

async function writeDisk(albumId: number, tags: string[]): Promise<void> {
  try {
    await storage.set(tagKey(albumId), JSON.stringify(tags));
  } catch {
    // ignore quota errors
  }
}

/** Cached tags only; never touches the network. */
export function peekAlbumTags(albumId: number): string[] | null {
  return memory.get(albumId) ?? null;
}

export function seedAlbumTags(albumId: number, tags: string[]): void {
  if (tags.length === 0) return;
  memory.set(albumId, tags);
  void writeDisk(albumId, tags);
}

async function load(api: ApiClient, albumId: number): Promise<string[] | null> {
  const hit = memory.get(albumId);
  if (hit) return hit;
  const cached = await readDisk(albumId);
  if (cached) {
    memory.set(albumId, cached);
    return cached;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const detail = await api.getAlbum(albumId);
      if (detail.tags.length > 0) {
        memory.set(albumId, detail.tags);
        void writeDisk(albumId, detail.tags);
        return detail.tags;
      }
      return null;
    } catch {
      if (attempt === 0) await sleep(400);
    }
  }
  return null;
}

/** One `/album` request per album id, shared by every caller. */
export function fetchAlbumTagsFor(api: ApiClient, albumId: number): Promise<string[] | null> {
  const existing = inflight.get(albumId);
  if (existing) return existing;
  const task = load(api, albumId).finally(() => {
    inflight.delete(albumId);
  });
  inflight.set(albumId, task);
  return task;
}

/** Fetches tags for a batch with a bounded worker pool. */
export async function fetchAlbumTagsBatch(
  api: ApiClient,
  albumIds: number[],
  concurrency = DETAIL_FETCH_CONCURRENCY
): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();
  const queue = [...new Set(albumIds)];
  const workers = Array.from({length: Math.min(concurrency, queue.length)}, async () => {
    for (;;) {
      const id = queue.shift();
      if (id === undefined) break;
      const tags = await fetchAlbumTagsFor(api, id);
      if (tags) result.set(id, tags);
    }
  });
  await Promise.all(workers);
  return result;
}

export function clearAlbumTagsCache(): void {
  memory.clear();
  inflight.clear();
}
