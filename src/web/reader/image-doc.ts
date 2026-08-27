import {Capacitor} from '@capacitor/core';
import {Directory, Filesystem} from '@capacitor/filesystem';
import {useSettingsStore} from '../stores/settings';
import {toSafRelativePath} from '../library/safPaths';
import {safGetEntryUri, safListDirectory} from '../library/safStorage';

export interface ImageDocMeta {
  pagesDir: string;
  pageCount: number;
  files: string[];
  srcs: (string | undefined)[];
  baseSrc?: string;
}

const CACHE_LIMIT = 3;
const imageCache = new Map<string, ImageDocMeta>();

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp']);

function isImageFile(name: string): boolean {
  return IMAGE_EXTS.has((name.split('.').pop() ?? '').toLowerCase());
}

function sortByNumericName(a: string, b: string): number {
  const na = Number.parseInt(a, 10) || 0;
  const nb = Number.parseInt(b, 10) || 0;
  return na - nb;
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

function fillSrcsFromBase(meta: ImageDocMeta): void {
  if (!meta.baseSrc) return;
  const base = meta.baseSrc.endsWith('/') ? meta.baseSrc : `${meta.baseSrc}/`;
  for (let i = 0; i < meta.files.length; i++) {
    if (!meta.srcs[i]) {
      meta.srcs[i] = base + meta.files[i];
    }
  }
}

export async function loadImageDocMeta(pagesDir: string): Promise<ImageDocMeta> {
  const cached = imageCache.get(pagesDir);
  if (cached) {
    imageCache.delete(pagesDir);
    imageCache.set(pagesDir, cached);
    if (cached.baseSrc) fillSrcsFromBase(cached);
    return cached;
  }
  const {downloadPath, downloadTreeUri} = useSettingsStore.getState().settings;
  if (downloadTreeUri) {
    return loadSafImageDocMeta(pagesDir, downloadTreeUri, downloadPath);
  }
  const [dir, uri] = await Promise.all([
    Filesystem.readdir({
      path: pagesDir,
      directory: Directory.Documents,
    }),
    Filesystem.getUri({
      path: pagesDir,
      directory: Directory.Documents,
    }),
  ]);
  const files = dir.files
    .filter(f => f.type === 'file' && isImageFile(f.name))
    .sort((a, b) => sortByNumericName(a.name, b.name))
    .map(f => f.name);
  const baseSrc = Capacitor.convertFileSrc(uri.uri);
  const entry: ImageDocMeta = {
    pagesDir,
    pageCount: files.length,
    files,
    srcs: new Array<string | undefined>(files.length),
    baseSrc,
  };
  fillSrcsFromBase(entry);
  cacheEntry(pagesDir, entry);
  return entry;
}

async function loadSafImageDocMeta(
  pagesDir: string,
  treeUri: string,
  downloadPath: string,
): Promise<ImageDocMeta> {
  const rel = toSafRelativePath(pagesDir, downloadPath);
  const entries = await safListDirectory(treeUri, rel);
  const files = entries
    .filter(e => e.type === 'file' && isImageFile(e.name))
    .sort((a, b) => sortByNumericName(a.name, b.name))
    .map(e => e.name);
  const srcs = await Promise.all(
    files.map(async name => {
      const uri = await safGetEntryUri(treeUri, `${rel}/${name}`);
      return Capacitor.convertFileSrc(uri);
    }),
  );
  const entry: ImageDocMeta = {
    pagesDir,
    pageCount: files.length,
    files,
    srcs,
  };
  cacheEntry(pagesDir, entry);
  return entry;
}

