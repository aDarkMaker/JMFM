import {Directory, Filesystem} from '@capacitor/filesystem';
import {LibraryItem} from '../stores/library';
import {PagesContext, collectAlbumPages, downloadPages} from '../../core/download/pages';
import {clearImageDocCache} from '../reader/image-doc';
import {resolveItemPaths} from './resolveLibraryPaths';
import {downloadCover} from './cover';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

export type Defect =
  | {kind: 'path'}
  | {kind: 'metadata'}
  | {kind: 'cover'}
  | {kind: 'pages'}
  | {kind: 'missing'};

export interface RepairDeps extends PagesContext {
  downloadPath: string;
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

function extOf(name: string): string {
  return (name.split('.').pop() ?? '').toLowerCase();
}

async function listDir(path: string): Promise<{name: string; type: string}[]> {
  try {
    const r = await Filesystem.readdir({
      path,
      directory: Directory.Documents,
    });
    return r.files.map(f => ({name: f.name, type: f.type ?? 'file'}));
  } catch {
    return [];
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await Filesystem.stat({path, directory: Directory.Documents});
    return true;
  } catch {
    return false;
  }
}

async function inspectItem(item: LibraryItem, format: string): Promise<Defect[]> {
  if (
    !item.pagesDir ||
    item.filePath.toLowerCase().endsWith('.pdf') ||
    item.pageCount == null ||
    item.pageCount <= 0
  ) {
    const hasDir = item.pagesDir && (await pathExists(item.pagesDir));
    return hasDir ? [{kind: 'pages'}] : [{kind: 'missing'}];
  }
  if (!(await pathExists(item.pagesDir))) {
    return [{kind: 'missing'}];
  }
  const want = normalizeFormat(format);
  const pageFiles = (await listDir(item.pagesDir)).filter(
    e => e.type === 'file' && IMAGE_EXTS.has(extOf(e.name)),
  );
  const defects: Defect[] = [];
  const formatOk = (name: string) => {
    const ext = extOf(name);
    if (!IMAGE_EXTS.has(ext)) return true;
    return (ext === 'jpeg' ? 'jpg' : ext) === want;
  };
  if (pageFiles.length !== item.pageCount || pageFiles.some(e => !formatOk(e.name))) {
    defects.push({kind: 'pages'});
  }
  if (!item.coverPath || !(await pathExists(item.coverPath))) {
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
): Promise<ScanResult> {
  const issues: {item: LibraryItem; defects: Defect[]}[] = [];
  const remapped: LibraryItem[] = [];
  let compliant = 0;
  for (const item of items) {
    if (downloadPath) {
      const resolved = await resolveItemPaths(item, downloadPath);
      if (resolved) {
        remapped.push(resolved);
        compliant += 1;
        continue;
      }
    }
    const defects = await inspectItem(item, format);
    if (defects.length === 0) {
      compliant += 1;
    } else {
      issues.push({item, defects});
    }
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
  onProgress?: (done: number, total: number) => void,
): Promise<RepairResult> {
  const {runtime, source, http} = deps;
  if (!item.pagesDir || !(await pathExists(item.pagesDir))) {
    return {title: item.title, kind: 'missing', pagesAdded: 0};
  }

  const want = normalizeFormat(deps.imageFormat ?? 'webp');
  const {album, items} = await collectAlbumPages(source, item.albumId);
  const done: Defect['kind'][] = [];
  let pagesAdded = 0;

  const pageFiles = (await listDir(item.pagesDir)).filter(
    e => e.type === 'file' && IMAGE_EXTS.has(extOf(e.name)),
  );
  if (pageFiles.length !== items.length) {
    await downloadPages(
      deps,
      items,
      item.pagesDir,
      0,
      undefined,
      undefined,
      {preferredExt: want},
    );
    pagesAdded = Math.max(0, items.length - pageFiles.length);
    done.push('pages');
  }

  if (!item.coverPath || !(await pathExists(item.coverPath))) {
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

export async function deleteAlbumDir(item: LibraryItem): Promise<void> {
  await Filesystem.rmdir({
    path: item.filePath,
    directory: Directory.Documents,
    recursive: true,
  }).catch(() => undefined);
  if (item.pagesDir) {
    clearImageDocCache(item.pagesDir);
  }
}
