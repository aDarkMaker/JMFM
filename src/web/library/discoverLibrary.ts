import {Directory, Filesystem} from '@capacitor/filesystem';
import type {LibraryItem} from '../stores/library';
import {LEGACY_PREFIXES} from './resolveLibraryPaths';
import {toSafRelativePath} from './safPaths';
import {safListDirectory, safReadTextFile} from './safStorage';

const META_FILE = '.jmf-meta.json';
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
/** Offset so locally-hashed ids never collide with real API album ids. */
const LOCAL_ID_OFFSET = 1_000_000_000;

export interface LocalAlbumMeta {
  albumId?: number;
  title?: string;
  author?: string;
  tags?: string[];
  chapterCount?: number;
  pageCount?: number;
  coverPath?: string;
}

/** Stable hash of the pages dir; used as albumId when no meta exists. */
export function albumIdForLocalPath(pagesDir: string): number {
  let hash = 5381;
  for (let i = 0; i < pagesDir.length; i++) {
    hash = ((hash << 5) + hash + pagesDir.charCodeAt(i)) | 0;
  }
  return LOCAL_ID_OFFSET + ((hash >>> 0) % LOCAL_ID_OFFSET);
}

export function parseLocalMeta(raw: string): LocalAlbumMeta | null {
  try {
    const data = JSON.parse(raw) as LocalAlbumMeta;
    if (typeof data !== 'object' || data === null) return null;
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    if (!title) return null;
    return {
      albumId: typeof data.albumId === 'number' ? data.albumId : undefined,
      title,
      author: typeof data.author === 'string' ? data.author : undefined,
      tags: Array.isArray(data.tags) ? data.tags.map(String) : undefined,
      chapterCount: typeof data.chapterCount === 'number' ? data.chapterCount : undefined,
      pageCount: typeof data.pageCount === 'number' ? data.pageCount : undefined,
      coverPath: typeof data.coverPath === 'string' ? data.coverPath : undefined,
    };
  } catch {
    return null;
  }
}

function extOf(name: string): string {
  return (name.split('.').pop() ?? '').toLowerCase();
}

/** Merge discovered items with existing ones, deduped by pagesDir or real albumId. */
export function mergeDiscovered(existing: LibraryItem[], discovered: LibraryItem[]): LibraryItem[] {
  const byPagesDir = new Map<string, LibraryItem>();
  const byRealId = new Map<number, LibraryItem>();
  for (const item of existing) {
    if (item.pagesDir) byPagesDir.set(item.pagesDir, item);
    if (item.albumId > 0 && item.albumId < LOCAL_ID_OFFSET) {
      byRealId.set(item.albumId, item);
    }
  }
  const merged = [...existing];
  for (const item of discovered) {
    if (item.pagesDir && byPagesDir.has(item.pagesDir)) continue;
    if (item.albumId < LOCAL_ID_OFFSET && byRealId.has(item.albumId)) continue;
    if (item.pagesDir) byPagesDir.set(item.pagesDir, item);
    if (item.albumId < LOCAL_ID_OFFSET) byRealId.set(item.albumId, item);
    merged.push(item);
  }
  return merged;
}

export interface LibraryScanner {
  listDirs(path: string): Promise<string[]>;
  listImages(path: string): Promise<string[]>;
  readMeta(path: string): Promise<LocalAlbumMeta | null>;
}

function safScanner(treeUri: string, downloadPath: string): LibraryScanner {
  return {
    async listDirs(path) {
      try {
        const rel = toSafRelativePath(path, downloadPath);
        const entries = await safListDirectory(treeUri, rel);
        return entries.filter((e) => e.type === 'directory').map((e) => e.name);
      } catch {
        return [];
      }
    },
    async listImages(path) {
      try {
        const rel = toSafRelativePath(path, downloadPath);
        const entries = await safListDirectory(treeUri, rel);
        return entries
          .filter((e) => e.type === 'file' && IMAGE_EXTS.has(extOf(e.name)))
          .map((e) => e.name);
      } catch {
        return [];
      }
    },
    async readMeta(path) {
      try {
        const rel = toSafRelativePath(`${path}/${META_FILE}`, downloadPath);
        const raw = await safReadTextFile(treeUri, rel);
        return parseLocalMeta(raw);
      } catch {
        return null;
      }
    },
  };
}

function nativeScanner(): LibraryScanner {
  return {
    async listDirs(path) {
      try {
        const r = await Filesystem.readdir({path, directory: Directory.Documents});
        return r.files.filter((f) => f.type !== 'file').map((f) => f.name);
      } catch {
        return [];
      }
    },
    async listImages(path) {
      try {
        const r = await Filesystem.readdir({path, directory: Directory.Documents});
        return r.files
          .filter((f) => f.type !== 'directory' && IMAGE_EXTS.has(extOf(f.name)))
          .map((f) => f.name);
      } catch {
        return [];
      }
    },
    async readMeta(path) {
      try {
        const r = await Filesystem.readFile({
          path: `${path}/${META_FILE}`,
          directory: Directory.Documents,
        });
        if (typeof r.data !== 'string') {
          return null;
        }
        return parseLocalMeta(r.data);
      } catch {
        return null;
      }
    },
  };
}

async function discoverUnderBase(
  base: string,
  existingByDir: Set<string>,
  existingByRealId: Set<number>,
  scanner: LibraryScanner
): Promise<LibraryItem[]> {
  const dirs = await scanner.listDirs(base);
  const found: LibraryItem[] = [];
  for (const dirName of dirs) {
    if (dirName.startsWith('.')) continue;
    const albumDir = `${base}/${dirName}`;
    const pagesDir = `${albumDir}/pages`;
    if (existingByDir.has(pagesDir)) continue;
    const images = await scanner.listImages(pagesDir);
    if (images.length === 0) continue;
    const meta = await scanner.readMeta(albumDir);
    const albumId = meta?.albumId ?? albumIdForLocalPath(pagesDir);
    if (albumId < LOCAL_ID_OFFSET && existingByRealId.has(albumId)) continue;
    found.push({
      albumId,
      title: meta?.title ?? dirName,
      author: meta?.author,
      tags: meta?.tags,
      chapterCount: meta?.chapterCount ?? 1,
      pageCount: meta?.pageCount ?? images.length,
      filePath: albumDir,
      pagesDir,
      coverPath: meta?.coverPath,
      downloadedAt: Date.now(),
    });
    existingByDir.add(pagesDir);
    if (albumId < LOCAL_ID_OFFSET) existingByRealId.add(albumId);
  }
  return found;
}

export async function discoverLibraryFromDisk(
  items: LibraryItem[],
  downloadPath: string,
  scanner?: LibraryScanner,
  downloadTreeUri?: string
): Promise<LibraryItem[]> {
  const effectiveScanner =
    scanner ?? (downloadTreeUri ? safScanner(downloadTreeUri, downloadPath) : nativeScanner());
  const existingByDir = new Set(
    items.map((i) => i.pagesDir).filter((p): p is string => Boolean(p))
  );
  const existingByRealId = new Set(
    items.filter((i) => i.albumId > 0 && i.albumId < LOCAL_ID_OFFSET).map((i) => i.albumId)
  );
  const bases = [downloadPath, ...LEGACY_PREFIXES];
  const found: LibraryItem[] = [];
  for (const base of bases) {
    const discovered = await discoverUnderBase(
      base,
      existingByDir,
      existingByRealId,
      effectiveScanner
    );
    for (const item of discovered) {
      found.push(item);
      if (item.pagesDir) existingByDir.add(item.pagesDir);
      if (item.albumId < LOCAL_ID_OFFSET) existingByRealId.add(item.albumId);
    }
  }
  return found;
}
