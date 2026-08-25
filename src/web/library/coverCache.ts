import {Capacitor} from '@capacitor/core';
import {Directory, Filesystem} from '@capacitor/filesystem';

const uriCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

function isRemoteSrc(path: string): boolean {
  return /^(https?:|blob:|data:)/.test(path);
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

  const job = Filesystem.getUri({path: coverPath, directory: Directory.Documents})
    .then(r => {
      const src = Capacitor.convertFileSrc(r.uri);
      uriCache.set(coverPath, src);
      return src;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(coverPath);
    });

  inflight.set(coverPath, job);
  return job;
}

function decodeImage(src: string): Promise<void> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

export async function preloadCovers(paths: Array<string | undefined>): Promise<void> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  await Promise.all(
    unique.map(async path => {
      const src = await resolveCoverSrc(path);
      if (src) {
        await decodeImage(src);
      }
    }),
  );
}
