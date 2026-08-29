import {Capacitor} from '@capacitor/core';
import {Directory, Filesystem} from '@capacitor/filesystem';
import {useSettingsStore} from '../stores/settings';
import {toSafRelativePath} from '../../core/fs/saf/safPaths';
import {safGetEntryUri, safListDirectory} from '../../core/fs/saf/safStorage';
import {registerCacheClear} from '../util/cacheRegistry';

const uriCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

function isRemoteSrc(path: string): boolean {
  return /^(https?:|blob:|data:)/.test(path);
}

export function clearCoverCache(): void {
  uriCache.clear();
  inflight.clear();
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

async function resolveSafCoverSrc(
  treeUri: string,
  downloadPath: string,
  paths: string[]
): Promise<string | null> {
  for (const path of paths) {
    try {
      const rel = toSafRelativePath(path, downloadPath);
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
  if (downloadTreeUri) {
    const candidates = [coverPath];
    if (albumDir) {
      candidates.push(`${albumDir}/cover.jpg`);
    }
    const resolved = await resolveSafCoverSrc(downloadTreeUri, downloadPath, candidates);
    if (resolved) {
      return resolved;
    }
    if (albumDir) {
      try {
        const albumRel = toSafRelativePath(albumDir, downloadPath);
        const entries = await safListDirectory(downloadTreeUri, albumRel);
        if (entries.some((e) => e.type === 'file' && e.name === 'cover.jpg')) {
          const uri = await safGetEntryUri(downloadTreeUri, `${albumRel}/cover.jpg`);
          return toImgSrc(uri);
        }
      } catch {
        // ignore
      }
    }
    return null;
  }
  const candidates = [coverPath];
  if (albumDir) {
    candidates.push(`${albumDir}/cover.jpg`);
  }
  for (const path of candidates) {
    try {
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
