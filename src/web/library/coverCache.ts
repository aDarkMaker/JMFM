import {Capacitor} from '@capacitor/core';
import {Directory, Filesystem} from '@capacitor/filesystem';
import {useSettingsStore} from '@/web/stores/settings';
import {toSafRelativePath} from '@/core/fs/saf/safPaths';
import {safEntryExists, safGetEntryUri} from '@/core/fs/saf/safStorage';
import {registerCacheClear} from '@/web/util/cacheRegistry';

const uriCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

function isRemoteSrc(path: string): boolean {
  return /^(https?:|blob:|data:)/.test(path);
}

export function clearCoverCache(): void {
  uriCache.clear();
  inflight.clear();
}

export function invalidateCoverSrc(coverPath: string): void {
  uriCache.delete(coverPath);
}

registerCacheClear(clearCoverCache);

export function peekCoverSrc(coverPath: string): string | null {
  if (isRemoteSrc(coverPath)) {
    return coverPath;
  }
  return uriCache.get(coverPath) ?? null;
}

export async function resolveCoverSrc(
  coverPath: string,
  albumDir?: string
): Promise<string | null> {
  const cached = peekCoverSrc(coverPath);
  if (cached) {
    return cached;
  }
  if (isRemoteSrc(coverPath) || !Capacitor.isNativePlatform()) {
    return isRemoteSrc(coverPath) ? coverPath : null;
  }

  const cacheKey = albumDir ? `${coverPath}\0${albumDir}` : coverPath;
  const pending = inflight.get(cacheKey);
  if (pending) {
    return pending;
  }

  const job = resolveNativeCoverSrc(coverPath, albumDir)
    .then((src) => {
      if (src) {
        uriCache.set(coverPath, src);
      }
      return src;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(cacheKey);
    });

  inflight.set(cacheKey, job);
  return job;
}

function toImgSrc(uri: string): string {
  const converted = Capacitor.convertFileSrc(uri);
  return converted || uri;
}

function coverCandidates(coverPath: string, albumDir?: string): string[] {
  const candidates = [coverPath];
  if (albumDir) {
    const canonical = `${albumDir}/cover.jpg`;
    if (canonical !== coverPath) candidates.push(canonical);
  }
  return candidates;
}

async function resolveSafCoverSrc(
  treeUri: string,
  downloadPath: string,
  paths: string[]
): Promise<string | null> {
  // getEntryUri builds a URI without checking existence, so a stale coverPath
  // would otherwise shadow albumDir/cover.jpg forever.
  for (const path of paths) {
    try {
      const rel = toSafRelativePath(path, downloadPath);
      if (!rel || !(await safEntryExists(treeUri, rel))) continue;
      const uri = await safGetEntryUri(treeUri, rel);
      return toImgSrc(uri);
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function resolveNativeCoverSrc(
  coverPath: string,
  albumDir?: string
): Promise<string | null> {
  const {downloadPath, downloadTreeUri} = useSettingsStore.getState().settings;
  const candidates = coverCandidates(coverPath, albumDir);
  if (downloadTreeUri) {
    return resolveSafCoverSrc(downloadTreeUri, downloadPath, candidates);
  }
  for (const path of candidates) {
    try {
      await Filesystem.stat({path, directory: Directory.Documents});
      const r = await Filesystem.getUri({path, directory: Directory.Documents});
      return toImgSrc(r.uri);
    } catch {
      // try next
    }
  }
  return null;
}

function decodeImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

export async function preloadCovers(paths: Array<string | undefined>): Promise<void> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  await Promise.all(
    unique.map(async (path) => {
      const src = await resolveCoverSrc(path);
      if (src) {
        await decodeImage(src);
      }
    })
  );
}
