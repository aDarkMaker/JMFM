import {create} from 'zustand';

export interface LibraryItem {
  albumId: number;
  title: string;
  chapterCount: number;
  filePath: string;
  coverPath?: string;
  downloadedAt: number;
}

const KEY = 'jmf.library';

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

function save(items: LibraryItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

interface LibraryState {
  items: LibraryItem[];
  add(item: Omit<LibraryItem, 'downloadedAt'>): void;
  remove(albumId: number): void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  items: load(),
  add(item) {
    const items = [{...item, downloadedAt: Date.now()}, ...get().items.filter(i => i.albumId !== item.albumId)];
    set({items});
    save(items);
  },
  remove(albumId) {
    const items = get().items.filter(i => i.albumId !== albumId);
    set({items});
    save(items);
  },
}));
