import {Capacitor} from '@capacitor/core';
import {Directory, Filesystem} from '@capacitor/filesystem';

export interface ImageDocMeta {
  pagesDir: string;
  pageCount: number;
  files: string[];
  srcs: (string | undefined)[];
}

const CACHE_LIMIT = 3;
const imageCache = new Map<string, ImageDocMeta>();

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const PREFETCH_BATCH = 6;

function isImageFile(name: string): boolean {
  return IMAGE_EXTS.has((name.split('.').pop() ?? '').toLowerCase());
}

function cacheEntry(key: string, entry: ImageDocMeta): void {
  imageCache.delete(key);
  imageCache.set(key, entry);
  while (imageCache.size > CACHE_LIMIT) {
    const oldest = imageCache.keys().next().value as string;
    imageCache.delete(oldest);
  }
}

export function getImageDocMeta(pagesDir: string): ImageDocMeta | undefined {
  return imageCache.get(pagesDir);
}

export function clearImageDocCache(pagesDir?: string): void {
  if (pagesDir) {
    imageCache.delete(pagesDir);
  } else {
    imageCache.clear();
  }
}

export async function loadImageDocMeta(pagesDir: string): Promise<ImageDocMeta> {
  const cached = imageCache.get(pagesDir);
  if (cached) {
    imageCache.delete(pagesDir);
    imageCache.set(pagesDir, cached);
    return cached;
  }
  const dir = await Filesystem.readdir({
    path: pagesDir,
    directory: Directory.Documents,
  });
  const files = dir.files
    .filter(f => f.type === 'file' && isImageFile(f.name))
    .sort((a, b) => {
      const na = Number.parseInt(a.name, 10) || 0;
      const nb = Number.parseInt(b.name, 10) || 0;
      return na - nb;
    })
    .map(f => f.name);
  const entry: ImageDocMeta = {
    pagesDir,
    pageCount: files.length,
    files,
    srcs: new Array<string | undefined>(files.length),
  };
  cacheEntry(pagesDir, entry);
  return entry;
}

async function resolvePageSrc(meta: ImageDocMeta, index: number): Promise<string | undefined> {
  const existing = meta.srcs[index];
  if (existing) return existing;
  const name = meta.files[index];
  if (!name) return undefined;
  const r = await Filesystem.getUri({
    path: `${meta.pagesDir}/${name}`,
    directory: Directory.Documents,
  });
  const src = Capacitor.convertFileSrc(r.uri);
  meta.srcs[index] = src;
  return src;
}

export async function prefetchPageSrcs(meta: ImageDocMeta, indices: number[]): Promise<void> {
  const todo = indices.filter(i => i >= 0 && i < meta.pageCount && !meta.srcs[i]);
  for (let i = 0; i < todo.length; i += PREFETCH_BATCH) {
    const batch = todo.slice(i, i + PREFETCH_BATCH);
    await Promise.all(batch.map(index => resolvePageSrc(meta, index)));
  }
}
