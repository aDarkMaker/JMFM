import {create} from 'zustand';

export interface LibraryItem {
  albumId: number;
  title: string;
  chapterCount: number;
  filePath: string;
  pagesDir?: string;
  coverPath?: string;
  author?: string;
  tags?: string[];
  pageCount?: number;
  favorite?: boolean;
  lastOpenedAt?: number;
  downloadedAt: number;
}

const KEY = 'jmf.library';
const SAVE_DEBOUNCE_MS = 400;

function load(): LibraryItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as LibraryItem[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

let pendingSave: LibraryItem[] | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function flushSave(): void {
  saveTimer = null;
  if (!pendingSave) return;
  const snapshot = pendingSave;
  pendingSave = null;
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}

function scheduleSave(items: LibraryItem[]): void {
  pendingSave = items;
  if (saveTimer) return;
  saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushSave);
}

interface LibraryState {
  items: LibraryItem[];
  add(item: Omit<LibraryItem, 'downloadedAt'>): void;
  remove(albumId: number): void;
  toggleFavorite(albumId: number): void;
  markOpened(albumId: number): void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  items: load(),
  add(item) {
    const items = [{...item, downloadedAt: Date.now()}, ...get().items.filter(i => i.albumId !== item.albumId)];
    set({items});
    scheduleSave(items);
  },
  remove(albumId) {
    const items = get().items.filter(i => i.albumId !== albumId);
    set({items});
    scheduleSave(items);
  },
  toggleFavorite(albumId) {
    const items = get().items.map(i =>
      i.albumId === albumId ? {...i, favorite: !i.favorite} : i,
    );
    set({items});
    scheduleSave(items);
  },
  markOpened(albumId) {
    const items = get().items.map(i =>
      i.albumId === albumId ? {...i, lastOpenedAt: Date.now()} : i,
    );
    set({items});
    scheduleSave(items);
  },
}));
