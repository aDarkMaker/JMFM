import {createUserStorage} from '@/data/user-storage';
import {STORAGE_KEYS} from '@/data/storage-keys';

const MAX_RECENT = 10;

export async function readRecentSearches(): Promise<string[]> {
  try {
    const raw = await createUserStorage().get(STORAGE_KEYS.recentSearches);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

/** Moves the term to the front and de-duplicates. Returns the new list. */
export async function pushRecentSearch(term: string): Promise<string[]> {
  const trimmed = term.trim();
  if (!trimmed) return readRecentSearches();
  const current = await readRecentSearches();
  const next = [trimmed, ...current.filter((t) => t !== trimmed)].slice(0, MAX_RECENT);
  try {
    await createUserStorage().set(STORAGE_KEYS.recentSearches, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export async function clearRecentSearches(): Promise<void> {
  try {
    await createUserStorage().remove(STORAGE_KEYS.recentSearches);
  } catch {
    // ignore
  }
}
