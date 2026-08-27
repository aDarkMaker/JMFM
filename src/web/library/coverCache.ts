import {Capacitor} from '@capacitor/core';
import {Directory, Filesystem} from '@capacitor/filesystem';
import {useSettingsStore} from '../stores/settings';
import {toSafRelativePath} from './safPaths';
import {safGetEntryUri} from './safStorage';

const uriCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

function isRemoteSrc(path: string): boolean {
  return /^(https?:|blob:|data:)/.test(path);
}

export function clearCoverCache(): void {
  uriCache.clear();
  inflight.clear();
}

export function peekCoverSrc(coverPath: string): string | null {
  if (isRemoteSrc(coverPath)) {
    return coverPath;
  }
  return uriCache.get(coverPath) ?? null;
}

export async function resolveCoverSrc(coverPath: string): Promise<string | null> {
  const cached = peekCoverSrc(coverPath);
  if (cached) {
    return cached;
  }
  if (isRemoteSrc(coverPath) || !Capacitor.isNativePlatform()) {
    return isRemoteSrc(coverPath) ? coverPath : null;
  }

  const pending = inflight.get(coverPath);
  if (pending) {
    return pending;
  }

  const job = resolveNativeCoverSrc(coverPath)
    .then((src) => {
      if (src) {
        uriCache.set(coverPath, src);
      }
      return src;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(coverPath);
    });

  inflight.set(coverPath, job);
  return job;
}

async function resolveNativeCoverSrc(coverPath: string): Promise<string | null> {
  const {downloadPath, downloadTreeUri} = useSettingsStore.getState().settings;
  if (downloadTreeUri) {
    const rel = toSafRelativePath(coverPath, downloadPath);
    const uri = await safGetEntryUri(downloadTreeUri, rel);
    return Capacitor.convertFileSrc(uri);
  }
  const r = await Filesystem.getUri({path: coverPath, directory: Directory.Documents});
  return Capacitor.convertFileSrc(r.uri);
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
