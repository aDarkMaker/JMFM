import {Capacitor} from '@capacitor/core';
import {Directory, Filesystem} from '@capacitor/filesystem';
import {useSettingsStore} from '../stores/settings';
import {toSafRelativePath} from '../../core/fs/saf/safPaths';
import {safGetEntryUri, safListDirectory} from '../../core/fs/saf/safStorage';
import {IMAGE_EXT_SET, extOf} from '../../core/model';
import {registerCacheClear} from '../util/cacheRegistry';

export interface ImageDocMeta {
  pagesDir: string;
  pageCount: number;
  files: string[];
  srcs: (string | undefined)[];
  baseSrc?: string;
  /** Present for SAF trees; enables lazily resolving srcs past the first window. */
  saf?: {treeUri: string; rel: string};
}

const CACHE_LIMIT = 3;
const imageCache = new Map<string, ImageDocMeta>();
/** Deduplicates concurrent loads of the same pagesDir. */
const inflight = new Map<string, Promise<ImageDocMeta>>();
/** How many SAF srcs to resolve up front; the rest resolve lazily as the reader scrolls. */
const SAF_PRELOAD_SRCS = 8;

function isImageFile(name: string): boolean {
  return IMAGE_EXT_SET.has(extOf(name));
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

registerCacheClear(() => clearImageDocCache());

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
  const pending = inflight.get(pagesDir);
  if (pending) {
    return pending;
  }
  const job = loadImageDocMetaUncached(pagesDir).finally(() => {
    inflight.delete(pagesDir);
  });
  inflight.set(pagesDir, job);
  return job;
}

async function loadImageDocMetaUncached(pagesDir: string): Promise<ImageDocMeta> {
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
    .filter((f) => f.type === 'file' && isImageFile(f.name))
    .sort((a, b) => sortByNumericName(a.name, b.name))
    .map((f) => f.name);
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
  downloadPath: string
): Promise<ImageDocMeta> {
  const rel = toSafRelativePath(pagesDir, downloadPath);
  const entries = await safListDirectory(treeUri, rel);
  const files = entries
    .filter((e) => e.type === 'file' && isImageFile(e.name))
    .sort((a, b) => sortByNumericName(a.name, b.name))
    .map((e) => e.name);
  const srcs = new Array<string | undefined>(files.length);
  const first = Math.min(SAF_PRELOAD_SRCS, files.length);
  await Promise.all(
    Array.from({length: first}, async (_, i) => {
      const uri = await safGetEntryUri(treeUri, `${rel}/${files[i]}`);
      srcs[i] = Capacitor.convertFileSrc(uri);
    })
  );
  const entry: ImageDocMeta = {
    pagesDir,
    pageCount: files.length,
    files,
    srcs,
    saf: {treeUri, rel},
  };
  cacheEntry(pagesDir, entry);
  return entry;
}

/** Lazily resolves a single SAF page src on demand, caching it back into the meta entry. */
export async function resolveImageSrcLazy(
  meta: ImageDocMeta,
  index: number
): Promise<string | undefined> {
  const existing = meta.srcs[index];
  if (existing) {
    return existing;
  }
  if (!meta.saf) {
    return undefined;
  }
  const uri = await safGetEntryUri(meta.saf.treeUri, `${meta.saf.rel}/${meta.files[index]}`);
  const src = Capacitor.convertFileSrc(uri);
  meta.srcs[index] = src;
  return src;
}
