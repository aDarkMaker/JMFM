import {create} from 'zustand';
import {createUserStorage} from '../../data/user-storage';
import {STORAGE_KEYS} from '../../data/storage-keys';

const MAX_ENTRIES = 100;
const SAVE_DEBOUNCE_MS = 500;

export interface HistoryEntry {
  albumId: number;
  title: string;
  /** Chapter currently open; local reads may omit it. */
  photoId?: number;
  chapterSort?: number;
  page: number;
  total: number;
  coverPath?: string;
  updatedAt: number;
}

interface HistoryState {
  entries: Record<string, HistoryEntry>;
  loaded: boolean;
  load(): Promise<void>;
  record(entry: Omit<HistoryEntry, 'updatedAt'>): void;
  get(albumId: number): HistoryEntry | undefined;
  recent(limit: number): HistoryEntry[];
  remove(albumId: number): void;
}

const storage = createUserStorage();
let pending: Record<string, HistoryEntry> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  timer = null;
  if (!pending) return;
  const snapshot = pending;
  pending = null;
  void storage.set(STORAGE_KEYS.history, JSON.stringify(Object.values(snapshot))).catch(() => undefined);
}

function scheduleSave(entries: Record<string, HistoryEntry>): void {
  pending = entries;
  if (timer) return;
  timer = setTimeout(flush, SAVE_DEBOUNCE_MS);
}

/** Keeps the newest MAX_ENTRIES by updatedAt. */
export function pruneEntries(entries: Record<string, HistoryEntry>): Record<string, HistoryEntry> {
  const list = Object.values(entries);
  if (list.length <= MAX_ENTRIES) {
    return entries;
  }
  const kept = list.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_ENTRIES);
  return Object.fromEntries(kept.map((e) => [String(e.albumId), e]));
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: {},
  loaded: false,

  async load() {
    try {
      const raw = await storage.get(STORAGE_KEYS.history);
      if (!raw) {
        set({loaded: true});
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      const list = Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
      const entries: Record<string, HistoryEntry> = {};
      for (const entry of list) {
        if (typeof entry?.albumId !== 'number') continue;
        entries[String(entry.albumId)] = entry;
      }
      set({entries: pruneEntries(entries), loaded: true});
    } catch {
      set({loaded: true});
    }
  },

  record(entry) {
    if (!Number.isFinite(entry.albumId) || entry.albumId <= 0) return;
    const next = pruneEntries({
      ...get().entries,
      [String(entry.albumId)]: {...entry, updatedAt: Date.now()},
    });
    set({entries: next});
    scheduleSave(next);
  },

  get(albumId) {
    return get().entries[String(albumId)];
  },

  recent(limit) {
    return Object.values(get().entries)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  },

  remove(albumId) {
    const next = {...get().entries};
    delete next[String(albumId)];
    set({entries: next});
    scheduleSave(next);
  },
}));

export function waitForHistoryLoaded(): Promise<void> {
  return new Promise((resolve) => {
    if (useHistoryStore.getState().loaded) {
      resolve();
      return;
    }
    const unsub = useHistoryStore.subscribe((state) => {
      if (state.loaded) {
        unsub();
        resolve();
      }
    });
  });
}
