import {LEGACY_PREFIXES} from './resolveLibraryPaths';

export function toSafRelativePath(logicalPath: string, downloadPath: string): string {
  const bases = [downloadPath, ...LEGACY_PREFIXES];
  for (const base of bases) {
    if (logicalPath === base) {
      return '';
    }
    const prefix = `${base}/`;
    if (logicalPath.startsWith(prefix)) {
      return logicalPath.slice(prefix.length);
    }
  }
  return logicalPath;
}

export function joinLogicalPath(downloadPath: string, relativePath: string): string {
  if (!relativePath) {
    return downloadPath;
  }
  return `${downloadPath}/${relativePath}`;
}
