import type {AlbumSummary} from '../../core/model';
import {createUserStorage, migrateFromLocalStorage} from '../../data/user-storage';
import {STORAGE_KEYS} from '../../data/storage-keys';

const storage = createUserStorage();

interface DailyCache {
  date: string;
  albums: AlbumSummary[];
}

function cacheKey(date: string): string {
  return `${STORAGE_KEYS.dailyCachePrefix}${date}`;
}

export async function readCache(date: string): Promise<AlbumSummary[] | null> {
  const raw = await migrateFromLocalStorage(storage, cacheKey(date));
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as DailyCache;
    if (data.date !== date || !Array.isArray(data.albums)) return null;
    return data.albums;
  } catch {
    return null;
  }
}

export function writeCache(date: string, albums: AlbumSummary[]): void {
  try {
    const payload: DailyCache = {date, albums};
    void storage.set(cacheKey(date), JSON.stringify(payload));
  } catch {
    // ignore quota errors
  }
}

export async function clearStaleCaches(keepDate: string): Promise<void> {
  try {
    const keys = await storage.keys(STORAGE_KEYS.dailyCachePrefix);
    await Promise.all(keys.filter((k) => k !== cacheKey(keepDate)).map((k) => storage.remove(k)));
  } catch {
    // ignore
  }
}
