export const LEGACY_PREFIXES = [
  'Documents/JMFDownloads',
  'JMFMobile/downloads',
  'JMFMobile/JMFDownloads',
  'Download/JMFDownloads',
  'JMFDownloads',
] as const;

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

/**
 * Normalized dedup key for an album directory or pages dir, relative to the
 * download root. Both `Documents/JMFDownloads/Title/pages` and
 * `JMFDownloads/Title/pages` collapse to `Title/pages`.
 */
export function albumRelativeKey(downloadPath: string, albumOrPagesPath: string): string {
  const rel = toSafRelativePath(albumOrPagesPath, downloadPath);
  return rel.replace(/\/pages$/, '');
}
