import {Directory, Filesystem} from '@capacitor/filesystem';
import {LibraryItem} from '../stores/library';
import {PagesContext, collectAlbumPages, downloadPages} from '../../core/download/pages';
import type {DownloadRuntime} from '../../core/download';
import {IMAGE_EXT_SET, extOf} from '../../core/model';
import {clearImageDocCache} from '../reader/image-doc';
import {resolveItemPaths} from './resolveLibraryPaths';
import {toSafRelativePath} from '../../core/fs/saf/safPaths';
import {safEntryExists, safListDirectory} from '../../core/fs/saf/safStorage';
import {downloadCover} from './cover';

export type Defect =
  {kind: 'path'} | {kind: 'metadata'} | {kind: 'cover'} | {kind: 'pages'} | {kind: 'missing'};

/** Only missing albums should be re-downloaded via the repair queue. */
export function needsRedownload(defects: Defect[]): boolean {
  return defects.some((d) => d.kind === 'missing');
}

export interface RepairDeps extends PagesContext {
  downloadPath: string;
  downloadTreeUri?: string;
}

export interface ScanResult {
  compliant: number;
  remapped: LibraryItem[];
  issues: {item: LibraryItem; defects: Defect[]}[];
}

export interface RepairResult {
  title: string;
  kind: Defect['kind'] | 'repaired';
  pagesAdded: number;
}

function normalizeFormat(format: string): string {
  const f = format.toLowerCase();
  if (f === 'jpeg') return 'jpg';
  return f || 'webp';
}

async function listDir(
  path: string,
  treeUri?: string,
  downloadPath?: string
): Promise<{name: string; type: string}[]> {
  if (treeUri && downloadPath) {
    try {
      const rel = toSafRelativePath(path, downloadPath);
      const entries = await safListDirectory(treeUri, rel);
      return entries.map((e) => ({
        name: e.name,
        type: e.type === 'directory' ? 'directory' : 'file',
      }));
    } catch {
      return [];
    }
  }
  try {
    const r = await Filesystem.readdir({
      path,
      directory: Directory.Documents,
    });
    return r.files.map((f) => ({name: f.name, type: f.type ?? 'file'}));
  } catch {
    return [];
  }
}

async function pathExists(path: string, treeUri?: string, downloadPath?: string): Promise<boolean> {
  if (treeUri && downloadPath) {
    return safEntryExists(treeUri, toSafRelativePath(path, downloadPath));
  }
  try {
    await Filesystem.stat({path, directory: Directory.Documents});
    return true;
  } catch {
    return false;
  }
}

async function pagesDirHasImages(
  pagesDir: string,
  treeUri?: string,
  downloadPath?: string
): Promise<boolean> {
  if (treeUri && downloadPath) {
    const files = await listDir(pagesDir, treeUri, downloadPath);
    return files.some((e) => e.type === 'file' && IMAGE_EXT_SET.has(extOf(e.name)));
  }
  return pathExists(pagesDir, treeUri, downloadPath);
}

async function albumHasCover(
  item: LibraryItem,
  treeUri?: string,
  downloadPath?: string
): Promise<boolean> {
  const albumDir = item.filePath || item.pagesDir?.replace(/\/pages$/, '');
  if (!albumDir) {
    return false;
  }
  if (treeUri && downloadPath) {
    const files = await listDir(albumDir, treeUri, downloadPath);
    return files.some((e) => e.type === 'file' && e.name === 'cover.jpg');
  }
  if (item.coverPath && (await pathExists(item.coverPath, treeUri, downloadPath))) {
    return true;
  }
  return pathExists(`${albumDir}/cover.jpg`, treeUri, downloadPath);
}

async function inspectItem(
  item: LibraryItem,
  format: string,
  treeUri?: string,
  downloadPath?: string
): Promise<Defect[]> {
  if (!item.pagesDir || item.filePath.toLowerCase().endsWith('.pdf')) {
    return [{kind: 'missing'}];
  }
  const pagesOk = await pagesDirHasImages(item.pagesDir, treeUri, downloadPath);
  if (!pagesOk) {
    return [{kind: 'missing'}];
  }
  const defects: Defect[] = [];
  const want = normalizeFormat(format);
  const pageFiles = (await listDir(item.pagesDir, treeUri, downloadPath)).filter(
    (e) => e.type === 'file' && IMAGE_EXT_SET.has(extOf(e.name))
  );
  const formatOk = (name: string) => {
    const ext = extOf(name);
    if (!IMAGE_EXT_SET.has(ext)) return true;
    return (ext === 'jpeg' ? 'jpg' : ext) === want;
  };
  if (
    item.pageCount != null &&
    item.pageCount > 0 &&
    (pageFiles.length !== item.pageCount || pageFiles.some((e) => !formatOk(e.name)))
  ) {
    defects.push({kind: 'pages'});
  }
  if (!(await albumHasCover(item, treeUri, downloadPath))) {
    defects.push({kind: 'cover'});
  }
  if (!item.tags || item.tags.length === 0) {
    defects.push({kind: 'metadata'});
  }
  return defects;
}

export async function scanLibraryRepair(
  items: LibraryItem[],
  format: string,
  downloadPath?: string,
  downloadTreeUri?: string,
  onProgress?: (done: number, total: number) => void
): Promise<ScanResult> {
  const issues: {item: LibraryItem; defects: Defect[]}[] = [];
  const remapped: LibraryItem[] = [];
  let compliant = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (downloadPath) {
      const resolved = await resolveItemPaths(item, downloadPath, undefined, downloadTreeUri);
      if (resolved) {
        remapped.push(resolved);
        compliant += 1;
        onProgress?.(i + 1, items.length);
        continue;
      }
    }
    const defects = await inspectItem(item, format, downloadTreeUri, downloadPath);
    if (defects.length === 0) {
      compliant += 1;
    } else {
      issues.push({item, defects});
    }
    onProgress?.(i + 1, items.length);
  }
  return {compliant, remapped, issues};
}

/**
 * Repairs a single album incrementally: backfills missing pages, redownloads
 * the cover, and refreshes stale metadata. Returns 'missing' when the album
 * directory is gone entirely, in which case the caller re-downloads it.
 */
export async function repairItem(
  deps: RepairDeps,
  item: LibraryItem,
  onProgress?: (done: number, total: number) => void
): Promise<RepairResult> {
  const {runtime, source, http} = deps;
  const treeUri = deps.downloadTreeUri;
  const downloadPath = deps.downloadPath;
  if (!item.pagesDir || !(await pathExists(item.pagesDir, treeUri, downloadPath))) {
    return {title: item.title, kind: 'missing', pagesAdded: 0};
  }

  const want = normalizeFormat(deps.imageFormat ?? 'webp');
  const {album, items} = await collectAlbumPages(source, item.albumId);
  const done: Defect['kind'][] = [];
  let pagesAdded = 0;

  const pageFiles = (await listDir(item.pagesDir, treeUri, downloadPath)).filter(
    (e) => e.type === 'file' && IMAGE_EXT_SET.has(extOf(e.name))
  );
  if (pageFiles.length !== items.length) {
    await downloadPages(deps, items, item.pagesDir, 0, undefined, undefined, {preferredExt: want});
    pagesAdded = Math.max(0, items.length - pageFiles.length);
    done.push('pages');
  }

  if (!item.coverPath || !(await pathExists(item.coverPath, treeUri, downloadPath))) {
    const cover = await downloadCover(http, runtime.fs, item.albumId, item.filePath);
    done.push('cover');
    if (cover) {
      item.coverPath = cover;
    }
  }

  const wantsMetadata = !item.tags || item.tags.length === 0;
  if (wantsMetadata) {
    item.tags = album.tags;
    item.title = album.name;
    item.author = album.author;
    item.pageCount = items.length;
    done.push('metadata');
  }

  if (item.pagesDir) {
    clearImageDocCache(item.pagesDir);
  }
  onProgress?.(1, 1);
  return {
    title: item.title,
    kind: done.length > 0 ? 'repaired' : 'metadata',
    pagesAdded,
  };
}

export async function deleteAlbumDir(
  item: LibraryItem,
  runtime?: DownloadRuntime
): Promise<void> {
  if (runtime) {
    await runtime.fs.unlink(item.filePath).catch(() => undefined);
  } else {
    await Filesystem.rmdir({
      path: item.filePath,
      directory: Directory.Documents,
      recursive: true,
    }).catch(() => undefined);
  }
  if (item.pagesDir) {
    clearImageDocCache(item.pagesDir);
  }
}
