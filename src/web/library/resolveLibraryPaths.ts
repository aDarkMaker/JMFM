import {Directory, Filesystem} from '@capacitor/filesystem';
import type {LibraryItem} from '../stores/library';

export const LEGACY_PREFIXES = ['JMFMobile/downloads', 'JMFMobile/JMFDownloads'] as const;

export function safeTitle(title: string): string {
  return title.replace(/[/\\:*?"<>|]/g, '_');
}

async function defaultPathExists(path: string): Promise<boolean> {
  try {
    await Filesystem.stat({path, directory: Directory.Documents});
    return true;
  } catch {
    return false;
  }
}

/**
 * FilePicker returns a SAF path like content://.../tree/primary%3ADownload.
 * Decode it and take the last readable segment (dropping the `primary:` prefix)
 * so URL-encoded names never leak garbage into the stored path.
 */
export function parsePickedDirectory(path: string, appDir = 'JMFDownloads'): string {
  try {
    const decoded = decodeURIComponent(path);
    const segment = decoded.split('/').filter(Boolean).pop() ?? '';
    const name = segment.split(':').pop() ?? '';
    if (name && name !== appDir) {
      return `${name}/${appDir}`;
    }
    return name || appDir;
  } catch {
    return appDir;
  }
}

/**
 * When pagesDir is gone, probe the current downloadPath and known legacy
 * prefixes for the real files; returns a remapped item or null when missing.
 */
export async function resolveItemPaths(
  item: LibraryItem,
  downloadPath: string,
  exists: (path: string) => Promise<boolean> = defaultPathExists,
): Promise<LibraryItem | null> {
  if (item.pagesDir && (await exists(item.pagesDir))) {
    return null;
  }
  const safe = safeTitle(item.title);
  const bases = [downloadPath, ...LEGACY_PREFIXES];
  for (const base of bases) {
    const pagesDir = `${base}/${safe}/pages`;
    if (await exists(pagesDir)) {
      const albumDir = `${base}/${safe}`;
      const newCover = `${albumDir}/cover.jpg`;
      const coverExists = await exists(newCover);
      const oldCoverOk =
        item.coverPath != null && (await exists(item.coverPath));
      return {
        ...item,
        filePath: albumDir,
        pagesDir,
        coverPath: oldCoverOk ? item.coverPath : coverExists ? newCover : undefined,
      };
    }
  }
  return null;
}

export async function resolveLibraryPaths(
  items: LibraryItem[],
  downloadPath: string,
  exists: (path: string) => Promise<boolean> = defaultPathExists,
): Promise<LibraryItem[]> {
  const fixed: LibraryItem[] = [];
  for (const item of items) {
    const resolved = await resolveItemPaths(item, downloadPath, exists);
    if (resolved) {
      fixed.push(resolved);
    }
  }
  return fixed;
}
