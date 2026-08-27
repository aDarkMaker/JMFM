import type {AlbumSummary} from '../../core/model';
import {createUserStorage, migrateFromLocalStorage} from '../../data/user-storage';

const KEY_PREFIX = 'jmf.daily.';
const storage = createUserStorage();

interface DailyCache {
  date: string;
  albums: AlbumSummary[];
}

function cacheKey(date: string): string {
  return `${KEY_PREFIX}${date}`;
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
    const keys = await storage.keys(KEY_PREFIX);
    await Promise.all(keys.filter((k) => k !== cacheKey(keepDate)).map((k) => storage.remove(k)));
  } catch {
    // ignore
  }
}
