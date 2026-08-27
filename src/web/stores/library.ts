import {create} from 'zustand';
import {Capacitor} from '@capacitor/core';
import {createUserStorage, migrateFromLocalStorage} from '../../data/user-storage';
import {waitForSettingsLoaded, useSettingsStore} from './settings';
import {resolveLibraryPaths} from '../library/resolveLibraryPaths';
import {
  discoverLibraryFromDisk,
  dedupeLibraryItems,
  mergeDiscovered,
  backfillCoverPaths,
  repairAlbumIdsFromMeta,
  repairAlbumIdsFromTitle,
  LOCAL_ID_OFFSET,
} from '../library/discoverLibrary';
import {ApiClient} from '../../core/api';
import {createHttpClient} from '../../core/net';
import {writeLocalAlbumMeta} from '../library/saveToLibrary';
import {createRuntime} from '../../core/download/runtime';

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

const storage = createUserStorage();

function parseItems(raw: string | null): LibraryItem[] {
  if (!raw) return [];
  try {
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
    void storage.set(KEY, JSON.stringify(snapshot));
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
  loaded: boolean;
  load(options?: {force?: boolean}): Promise<void>;
  add(item: Omit<LibraryItem, 'downloadedAt'>): void;
  patchItem(albumId: number, patch: Partial<Omit<LibraryItem, 'albumId'>>): void;
  remove(albumId: number): void;
  toggleFavorite(albumId: number): void;
  markOpened(albumId: number): void;
}

let loadPromise: Promise<void> | null = null;
let titleRepairPromise: Promise<void> | null = null;

async function persistResolvedIds(
  before: LibraryItem[],
  after: LibraryItem[],
  downloadPath: string
): Promise<LibraryItem[]> {
  const next = dedupeLibraryItems(after, downloadPath);
  const hashItems = before.filter((i) => i.albumId >= LOCAL_ID_OFFSET && i.filePath);
  const runtime = createRuntime();
  for (const item of next) {
    if (item.albumId >= LOCAL_ID_OFFSET || !item.filePath) {
      continue;
    }
    const prev = hashItems.find((h) => h.filePath === item.filePath);
    if (!prev || prev.albumId === item.albumId) {
      continue;
    }
    await writeLocalAlbumMeta(runtime, item.filePath, {
      albumId: item.albumId,
      title: item.title,
      author: item.author,
      tags: item.tags,
      chapterCount: item.chapterCount,
      pageCount: item.pageCount,
      coverPath: item.coverPath,
    });
  }
  useLibraryStore.setState({items: next});
  try {
    await storage.set(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

async function repairTitleIds(items: LibraryItem[]): Promise<LibraryItem[]> {
  const hasHash = items.some((i) => i.albumId >= LOCAL_ID_OFFSET && i.filePath);
  if (!hasHash) {
    return items;
  }
  const {settings} = useSettingsStore.getState();
  const http = createHttpClient({
    ...(settings.proxyEnabled && settings.proxy ? {proxy: settings.proxy} : {}),
    maxRetries: settings.retryTimes,
  });
  const api = new ApiClient(http);
  const repaired = await repairAlbumIdsFromTitle(items, api);
  if (!repaired.changed) {
    return items;
  }
  return persistResolvedIds(items, repaired.items, settings.downloadPath);
}

async function repairTitleIdsInBackground(items: LibraryItem[]): Promise<void> {
  await repairTitleIds(items);
}

/** Resolve hash albumIds from meta + API search before repair/download. */
export async function ensureRealAlbumIds(): Promise<LibraryItem[]> {
  if (titleRepairPromise) {
    await titleRepairPromise;
    return useLibraryStore.getState().items;
  }
  const job = (async () => {
    await waitForLibraryLoaded();
    let items = useLibraryStore.getState().items;
    const {settings} = useSettingsStore.getState();
    const fromMeta = await repairAlbumIdsFromMeta(
      items,
      settings.downloadPath,
      undefined,
      settings.downloadTreeUri
    );
    items = fromMeta.items;
    items = await repairTitleIds(items);
    return items;
  })();
  titleRepairPromise = job.then(() => undefined).finally(() => {
    titleRepairPromise = null;
  });
  return job;
}

export function isHashAlbumId(albumId: number): boolean {
  return albumId >= LOCAL_ID_OFFSET;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  items: [],
  loaded: false,
  async load(options = {}) {
    if (loadPromise && !options.force) {
      return loadPromise;
    }
    const job = (async () => {
      const raw = await migrateFromLocalStorage(storage, KEY);
      const stored = parseItems(raw);
      const existing = get().items;
      const byId = new Map<number, LibraryItem>();
      for (const item of stored) byId.set(item.albumId, item);
      for (const item of existing) byId.set(item.albumId, item);
      let items = [...byId.values()];
      if (Capacitor.isNativePlatform()) {
        await waitForSettingsLoaded();
        const {settings} = useSettingsStore.getState();
        const fixed = await resolveLibraryPaths(
          items,
          settings.downloadPath,
          undefined,
          settings.downloadTreeUri
        );
        if (fixed.length > 0) {
          const byAlbum = new Map(fixed.map((i) => [i.albumId, i]));
          items = items.map((i) => byAlbum.get(i.albumId) ?? i);
        }
        const discovered = await discoverLibraryFromDisk(
          items,
          settings.downloadPath,
          undefined,
          settings.downloadTreeUri
        );
        if (discovered.length > 0) {
          items = mergeDiscovered(items, discovered, settings.downloadPath);
        }
        const backfill = await backfillCoverPaths(
          items,
          settings.downloadPath,
          undefined,
          settings.downloadTreeUri
        );
        items = backfill.items;
        const repaired = await repairAlbumIdsFromMeta(
          items,
          settings.downloadPath,
          undefined,
          settings.downloadTreeUri
        );
        items = repaired.items;
        items = dedupeLibraryItems(items, settings.downloadPath);
        if (
          fixed.length > 0 ||
          discovered.length > 0 ||
          backfill.changed ||
          repaired.changed
        ) {
          try {
            await storage.set(KEY, JSON.stringify(items));
          } catch {
            // ignore
          }
        }
      }
      set({items, loaded: true});
      if (Capacitor.isNativePlatform()) {
        void repairTitleIdsInBackground(items);
      }
    })().finally(() => {
      loadPromise = null;
    });
    loadPromise = job;
    return job;
  },
  add(item) {
    const items = [
      {...item, downloadedAt: Date.now()},
      ...get().items.filter((i) => i.albumId !== item.albumId),
    ];
    set({items});
    scheduleSave(items);
  },
  remove(albumId) {
    const items = get().items.filter((i) => i.albumId !== albumId);
    set({items});
    scheduleSave(items);
  },
  patchItem(albumId, patch) {
    const items = get().items.map((i) => (i.albumId === albumId ? {...i, ...patch} : i));
    set({items});
    scheduleSave(items);
  },
  toggleFavorite(albumId) {
    const items = get().items.map((i) =>
      i.albumId === albumId ? {...i, favorite: !i.favorite} : i
    );
    set({items});
    scheduleSave(items);
  },
  markOpened(albumId) {
    const items = get().items.map((i) =>
      i.albumId === albumId ? {...i, lastOpenedAt: Date.now()} : i
    );
    set({items});
    scheduleSave(items);
  },
}));

/** Await library load so consumers never read a half-initialized store. */
export function waitForLibraryLoaded(): Promise<void> {
  return new Promise((resolve) => {
    if (useLibraryStore.getState().loaded) {
      resolve();
      return;
    }
    const unsubscribe = useLibraryStore.subscribe((state) => {
      if (state.loaded) {
        unsubscribe();
        resolve();
      }
    });
  });
}
