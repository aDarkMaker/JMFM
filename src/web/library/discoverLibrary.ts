import {Directory, Filesystem} from '@capacitor/filesystem';
import type {LibraryItem} from '../stores/library';
import {LEGACY_PREFIXES} from './resolveLibraryPaths';
import {albumRelativeKey, toSafRelativePath} from './safPaths';
import {safFileExists, safListDirectory, safReadTextFile} from './safStorage';

const META_FILE = '.jmf-meta.json';
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
/** Offset so locally-hashed ids never collide with real API album ids. */
export const LOCAL_ID_OFFSET = 1_000_000_000;

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

/** Merge discovered items with existing ones, deduped by pagesDir, real albumId, or normalized path/title. */
export function mergeDiscovered(
  existing: LibraryItem[],
  discovered: LibraryItem[],
  downloadPath?: string
): LibraryItem[] {
  const byPagesDir = new Map<string, LibraryItem>();
  const byRealId = new Map<number, LibraryItem>();
  const byRelKey = new Map<string, LibraryItem>();
  const byTitle = new Map<string, LibraryItem>();
  for (const item of existing) {
    if (item.pagesDir) byPagesDir.set(item.pagesDir, item);
    if (item.albumId > 0 && item.albumId < LOCAL_ID_OFFSET) {
      byRealId.set(item.albumId, item);
    }
    if (downloadPath) {
      const key = item.pagesDir ?? item.filePath;
      if (key) byRelKey.set(albumRelativeKey(downloadPath, key), item);
    }
    if (item.albumId >= LOCAL_ID_OFFSET) {
      const normalizedTitle = item.title.trim().toLowerCase();
      if (normalizedTitle) byTitle.set(normalizedTitle, item);
    }
  }
  const merged = [...existing];
  for (const item of discovered) {
    if (item.pagesDir && byPagesDir.has(item.pagesDir)) continue;
    if (item.albumId < LOCAL_ID_OFFSET && byRealId.has(item.albumId)) continue;
    if (downloadPath) {
      const key = item.pagesDir ?? item.filePath;
      if (key && byRelKey.has(albumRelativeKey(downloadPath, key))) continue;
    }
    if (item.albumId >= LOCAL_ID_OFFSET) {
      const normalizedTitle = item.title.trim().toLowerCase();
      if (normalizedTitle && byTitle.has(normalizedTitle)) continue;
    }
    if (item.pagesDir) byPagesDir.set(item.pagesDir, item);
    if (item.albumId < LOCAL_ID_OFFSET) byRealId.set(item.albumId, item);
    if (downloadPath) {
      const key = item.pagesDir ?? item.filePath;
      if (key) byRelKey.set(albumRelativeKey(downloadPath, key), item);
    }
    if (item.albumId >= LOCAL_ID_OFFSET) {
      const normalizedTitle = item.title.trim().toLowerCase();
      if (normalizedTitle) byTitle.set(normalizedTitle, item);
    }
    merged.push(item);
  }
  return merged;
}

/**
 * Deduplicate persisted items after discovery: a single comic may exist under
 * multiple albumIds (different pagesDir hashes) after path migration.
 */
export function mergeLibraryDuplicates(
  target: LibraryItem,
  incoming: LibraryItem,
  downloadPath: string
): LibraryItem {
  const merged: LibraryItem = {...target};

  if (incoming.albumId < LOCAL_ID_OFFSET && target.albumId >= LOCAL_ID_OFFSET) {
    merged.albumId = incoming.albumId;
  } else if (
    incoming.albumId < LOCAL_ID_OFFSET &&
    target.albumId < LOCAL_ID_OFFSET &&
    incoming.albumId !== target.albumId
  ) {
    merged.albumId = incoming.albumId;
  }

  if ((!merged.tags || merged.tags.length === 0) && incoming.tags?.length) {
    merged.tags = incoming.tags;
  }
  if (!merged.author && incoming.author) {
    merged.author = incoming.author;
  }
  if ((!merged.pageCount || merged.pageCount <= 0) && incoming.pageCount) {
    merged.pageCount = incoming.pageCount;
  }
  if (incoming.coverPath && !merged.coverPath) {
    merged.coverPath = incoming.coverPath;
  }

  const preferPath = (a?: string, b?: string): string | undefined => {
    if (!a) return b;
    if (!b) return a;
    if (a.startsWith(`${downloadPath}/`) || a === downloadPath) return a;
    if (b.startsWith(`${downloadPath}/`) || b === downloadPath) return b;
    return a;
  };
  merged.filePath = preferPath(merged.filePath, incoming.filePath) ?? merged.filePath;
  merged.pagesDir = preferPath(merged.pagesDir, incoming.pagesDir) ?? merged.pagesDir;

  return merged;
}

function dedupeSortScore(item: LibraryItem, downloadPath: string): number {
  let score = 0;
  if (item.albumId < LOCAL_ID_OFFSET) score += 1000;
  if (item.coverPath) score += 100;
  if (item.pagesDir?.startsWith(`${downloadPath}/`) || item.filePath?.startsWith(`${downloadPath}/`)) {
    score += 50;
  }
  if (item.tags?.length) score += 10;
  if (item.author) score += 5;
  return score;
}

export function dedupeLibraryItems(items: LibraryItem[], downloadPath: string): LibraryItem[] {
  const sorted = [...items].sort(
    (a, b) => dedupeSortScore(b, downloadPath) - dedupeSortScore(a, downloadPath)
  );
  const byPagesDir = new Map<string, LibraryItem>();
  const byRealId = new Map<number, LibraryItem>();
  const byRelKey = new Map<string, LibraryItem>();
  const byTitle = new Map<string, LibraryItem>();
  const result: LibraryItem[] = [];

  const mergeInto = (target: LibraryItem, incoming: LibraryItem): void => {
    const merged = mergeLibraryDuplicates(target, incoming, downloadPath);
    const idx = result.indexOf(target);
    if (idx >= 0) {
      result[idx] = merged;
      if (merged.pagesDir) byPagesDir.set(merged.pagesDir, merged);
      if (merged.albumId < LOCAL_ID_OFFSET) byRealId.set(merged.albumId, merged);
      const key = merged.pagesDir ?? merged.filePath;
      if (key) byRelKey.set(albumRelativeKey(downloadPath, key), merged);
      const normalizedTitle = merged.title.trim().toLowerCase();
      if (normalizedTitle) byTitle.set(normalizedTitle, merged);
    }
  };

  for (const item of sorted) {
    if (item.pagesDir && byPagesDir.has(item.pagesDir)) continue;
    if (item.albumId > 0 && item.albumId < LOCAL_ID_OFFSET && byRealId.has(item.albumId)) {
      continue;
    }
    const key = item.pagesDir ?? item.filePath;
    if (key && byRelKey.has(albumRelativeKey(downloadPath, key))) {
      const target = byRelKey.get(albumRelativeKey(downloadPath, key))!;
      mergeInto(target, item);
      continue;
    }
    if (item.albumId >= LOCAL_ID_OFFSET) {
      const normalizedTitle = item.title.trim().toLowerCase();
      if (normalizedTitle) {
        const existing = byTitle.get(normalizedTitle);
        if (existing) {
          mergeInto(existing, item);
          continue;
        }
      }
    }
    result.push(item);
    if (item.pagesDir) byPagesDir.set(item.pagesDir, item);
    if (item.albumId > 0 && item.albumId < LOCAL_ID_OFFSET) byRealId.set(item.albumId, item);
    if (key) byRelKey.set(albumRelativeKey(downloadPath, key), item);
    if (item.albumId >= LOCAL_ID_OFFSET) {
      const normalizedTitle = item.title.trim().toLowerCase();
      if (normalizedTitle) byTitle.set(normalizedTitle, item);
    }
  }
  return result;
}

export interface LibraryScanner {
  listDirs(path: string): Promise<string[]>;
  listFiles(path: string): Promise<string[]>;
  listImages(path: string): Promise<string[]>;
  readMeta(path: string): Promise<LocalAlbumMeta | null>;
  fileExists(path: string): Promise<boolean>;
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
    async listFiles(path) {
      try {
        const rel = toSafRelativePath(path, downloadPath);
        const entries = await safListDirectory(treeUri, rel);
        return entries.filter((e) => e.type === 'file').map((e) => e.name);
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
    async fileExists(path) {
      try {
        const rel = toSafRelativePath(path, downloadPath);
        return await safFileExists(treeUri, rel);
      } catch {
        return false;
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
    async listFiles(path) {
      try {
        const r = await Filesystem.readdir({path, directory: Directory.Documents});
        return r.files.filter((f) => f.type !== 'directory').map((f) => f.name);
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
    async fileExists(path) {
      try {
        await Filesystem.stat({path, directory: Directory.Documents});
        return true;
      } catch {
        return false;
      }
    },
  };
}

async function discoverUnderBase(
  base: string,
  existingByDir: Set<string>,
  existingByRealId: Set<number>,
  existingByRelKey: Set<string>,
  downloadPath: string,
  scanner: LibraryScanner
): Promise<LibraryItem[]> {
  const dirs = await scanner.listDirs(base);
  const found: LibraryItem[] = [];
  for (const dirName of dirs) {
    if (dirName.startsWith('.')) continue;
    const albumDir = `${base}/${dirName}`;
    const pagesDir = `${albumDir}/pages`;
    if (existingByDir.has(pagesDir)) continue;
    const relKey = albumRelativeKey(downloadPath, pagesDir);
    if (existingByRelKey.has(relKey)) continue;
    const images = await scanner.listImages(pagesDir);
    if (images.length === 0) continue;
    const meta = await scanner.readMeta(albumDir);
    const albumId = meta?.albumId ?? albumIdForLocalPath(pagesDir);
    if (albumId < LOCAL_ID_OFFSET && existingByRealId.has(albumId)) continue;
    const coverPath = await resolveCoverPath(albumDir, meta?.coverPath, scanner);
    found.push({
      albumId,
      title: meta?.title ?? dirName,
      author: meta?.author,
      tags: meta?.tags,
      chapterCount: meta?.chapterCount ?? 1,
      pageCount: meta?.pageCount ?? images.length,
      filePath: albumDir,
      pagesDir,
      coverPath,
      downloadedAt: Date.now(),
    });
    existingByDir.add(pagesDir);
    existingByRelKey.add(relKey);
    if (albumId < LOCAL_ID_OFFSET) existingByRealId.add(albumId);
  }
  return found;
}

/** Prefer cover.jpg listed in the album dir; fall back to meta path when it still exists. */
async function resolveCoverPath(
  albumDir: string,
  metaCover: string | undefined,
  scanner: LibraryScanner
): Promise<string | undefined> {
  const files = await scanner.listFiles(albumDir);
  if (files.includes('cover.jpg')) {
    return `${albumDir}/cover.jpg`;
  }
  const canonical = `${albumDir}/cover.jpg`;
  if (await scanner.fileExists(canonical)) {
    return canonical;
  }
  if (metaCover && (await scanner.fileExists(metaCover))) {
    return metaCover;
  }
  return undefined;
}

/** Backfill cover.jpg for persisted items that were skipped during discovery. */
export async function backfillCoverPaths(
  items: LibraryItem[],
  downloadPath: string,
  scanner?: LibraryScanner,
  downloadTreeUri?: string
): Promise<{items: LibraryItem[]; changed: boolean}> {
  const effectiveScanner =
    scanner ?? (downloadTreeUri ? safScanner(downloadTreeUri, downloadPath) : nativeScanner());
  let changed = false;
  const result: LibraryItem[] = [];
  for (const item of items) {
    if (!item.filePath) {
      result.push(item);
      continue;
    }
    const canonical = `${item.filePath}/cover.jpg`;
    const files = await effectiveScanner.listFiles(item.filePath);
    if (files.includes('cover.jpg')) {
      if (item.coverPath !== canonical) changed = true;
      result.push({...item, coverPath: canonical});
      continue;
    }
    if (item.coverPath && (await effectiveScanner.fileExists(item.coverPath))) {
      result.push(item);
      continue;
    }
    if (item.coverPath) changed = true;
    result.push({...item, coverPath: undefined});
  }
  return {items: result, changed};
}

/** Patch hash albumIds from on-disk meta when available. */
export async function repairAlbumIdsFromMeta(
  items: LibraryItem[],
  downloadPath: string,
  scanner?: LibraryScanner,
  downloadTreeUri?: string
): Promise<{items: LibraryItem[]; changed: boolean}> {
  const effectiveScanner =
    scanner ?? (downloadTreeUri ? safScanner(downloadTreeUri, downloadPath) : nativeScanner());
  let changed = false;
  const result: LibraryItem[] = [];
  for (const item of items) {
    if (item.albumId < LOCAL_ID_OFFSET || !item.filePath) {
      result.push(item);
      continue;
    }
    const meta = await effectiveScanner.readMeta(item.filePath);
    if (meta?.albumId && meta.albumId < LOCAL_ID_OFFSET && meta.albumId !== item.albumId) {
      changed = true;
      result.push({...item, albumId: meta.albumId});
    } else {
      result.push(item);
    }
  }
  return {items: result, changed};
}

export interface TitleSearchResolver {
  searchAlbums(query: string, page?: number): Promise<{albums: {albumId: number; name: string}[]}>;
}

const TITLE_SEARCH_DELAY_MS = 600;

/** Resolve hash albumIds by exact title search against the API. */
export async function repairAlbumIdsFromTitle(
  items: LibraryItem[],
  resolver: TitleSearchResolver
): Promise<{items: LibraryItem[]; changed: boolean}> {
  let changed = false;
  const result: LibraryItem[] = [];
  for (const item of items) {
    if (item.albumId < LOCAL_ID_OFFSET || !item.filePath) {
      result.push(item);
      continue;
    }
    const title = item.title.trim();
    const folderName = item.filePath.split('/').filter(Boolean).pop()?.trim() ?? '';
    const matchNames = [...new Set([title, folderName].filter(Boolean))];
    if (matchNames.length === 0) {
      result.push(item);
      continue;
    }
    try {
      const query = matchNames[0]!;
      const {albums} = await resolver.searchAlbums(query, 1);
      const hit = albums.find((a) => matchNames.includes(a.name.trim()));
      if (hit && hit.albumId < LOCAL_ID_OFFSET && hit.albumId !== item.albumId) {
        changed = true;
        result.push({...item, albumId: hit.albumId});
      } else {
        result.push(item);
      }
    } catch {
      result.push(item);
    }
    await new Promise((r) => setTimeout(r, TITLE_SEARCH_DELAY_MS));
  }
  return {items: result, changed};
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
  const existingByRelKey = new Set(
    items.map((i) => {
      const key = i.pagesDir ?? i.filePath;
      return key ? albumRelativeKey(downloadPath, key) : '';
    }).filter(Boolean)
  );
  const bases = downloadTreeUri ? [downloadPath] : [downloadPath, ...LEGACY_PREFIXES];
  const found: LibraryItem[] = [];
  for (const base of bases) {
    const discovered = await discoverUnderBase(
      base,
      existingByDir,
      existingByRealId,
      existingByRelKey,
      downloadPath,
      effectiveScanner
    );
    for (const item of discovered) {
      found.push(item);
      if (item.pagesDir) existingByDir.add(item.pagesDir);
      if (item.albumId < LOCAL_ID_OFFSET) existingByRealId.add(item.albumId);
      const key = item.pagesDir ?? item.filePath;
      if (key) existingByRelKey.add(albumRelativeKey(downloadPath, key));
    }
  }
  return found;
}
