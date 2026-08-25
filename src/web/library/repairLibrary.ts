import {Directory, Filesystem} from '@capacitor/filesystem';
import {LibraryItem} from '../stores/library';
import {FileSystem} from '../../core/download/types';
import {clearImageDocCache} from '../reader/image-doc';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

function normalizeFormat(format: string): string {
  const f = format.toLowerCase();
  if (f === 'jpeg') return 'jpg';
  return f || 'webp';
}

function pageExtOk(name: string, want: string): boolean {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  if (!IMAGE_EXTS.has(ext)) return true;
  const normalized = ext === 'jpeg' ? 'jpg' : ext;
  return normalized === want;
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

export async function itemNeedsRepair(
  item: LibraryItem,
  format: string,
): Promise<boolean> {
  const want = normalizeFormat(format);

  // 1) 配置/元数据
  if (!item.pagesDir || item.filePath.toLowerCase().endsWith('.pdf')) {
    return true;
  }
  if (item.pageCount == null || item.pageCount <= 0) {
    return true;
  }

  // 2) webp + 页数
  if (!(await pathExists(item.pagesDir))) {
    return true;
  }
  const pageFiles = (await listDir(item.pagesDir)).filter(
    e => e.type === 'file' && IMAGE_EXTS.has((e.name.split('.').pop() ?? '').toLowerCase()),
  );
  if (pageFiles.length !== item.pageCount) {
    return true;
  }
  if (pageFiles.some(e => !pageExtOk(e.name, want))) {
    return true;
  }

  // 3) 封面缺失
  if (!item.coverPath || !(await pathExists(item.coverPath))) {
    return true;
  }

  return false;
}

export async function scanLibraryRepair(
  items: LibraryItem[],
  format: string,
): Promise<{compliant: number; needsRepair: LibraryItem[]}> {
  const needsRepair: LibraryItem[] = [];
  let compliant = 0;
  for (const item of items) {
    if (await itemNeedsRepair(item, format)) {
      needsRepair.push(item);
    } else {
      compliant += 1;
    }
  }
  return {compliant, needsRepair};
}

export async function repairLibraryItems(
  items: LibraryItem[],
  fs: FileSystem,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const total = items.length;
  let done = 0;
  for (const item of items) {
    if (item.pagesDir) {
      clearImageDocCache(item.pagesDir);
    }
    await fs.unlink(item.filePath).catch(() => undefined);
    done += 1;
    onProgress?.(done, total);
  }
}
