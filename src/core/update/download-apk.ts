import {Directory, Filesystem} from '@capacitor/filesystem';
import {Capacitor, type PluginListenerHandle} from '@capacitor/core';
import {bytesToBase64, base64ToBytes} from '@/core/util/base64';
import {Sha256, bytesToHex, sha256HexOf} from '@/core/util/sha256';
import {retry} from '@/core/net/retry';
import {UpdateHttpError, streamFetchBytes} from './http';
import {UPDATE_TIMEOUT} from './constants';

const APK_CACHE_NAME = 'JMFM-update.apk';

/** Write batch: accumulate before each native write to balance bridge calls and memory. */
const WRITE_CHUNK_BYTES = 1024 * 1024;
const HASH_CHUNK_BYTES = 1024 * 1024;

export type DownloadProgress = (loaded: number, total: number) => void;

/**
 * SHA-256 the current partial file belongs to, kept in memory so a dropped
 * connection resumes only within the same app session and release.
 */
let partialSha256: string | null = null;

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const merged = new Uint8Array(a.length + b.length);
  merged.set(a, 0);
  merged.set(b, a.length);
  return merged;
}

async function deleteCachedApk(): Promise<void> {
  partialSha256 = null;
  try {
    await Filesystem.deleteFile({
      path: APK_CACHE_NAME,
      directory: Directory.Cache,
    });
  } catch {
    // ignore missing file
  }
}

async function appendChunk(data: Uint8Array, first: boolean): Promise<void> {
  const options = {
    path: APK_CACHE_NAME,
    directory: Directory.Cache,
    data: bytesToBase64(data),
  } as const;
  if (first) {
    await Filesystem.writeFile({...options, recursive: true});
  } else {
    await Filesystem.appendFile(options);
  }
}

async function cachedApkBytes(): Promise<Uint8Array | null> {
  try {
    const res = await Filesystem.readFile({
      path: APK_CACHE_NAME,
      directory: Directory.Cache,
    });
    const data = res.data;
    if (typeof data === 'string') {
      return base64ToBytes(data);
    }
    if (data instanceof Blob) {
      return new Uint8Array(await data.arrayBuffer());
    }
    return null;
  } catch {
    return null;
  }
}

/** Hash the cached APK without relying on CapacitorHttp base64 round-trips. */
async function hashCachedApk(): Promise<string> {
  if (typeof Filesystem.readFileInChunks === 'function') {
    const hasher = new Sha256();
    let bytes = 0;
    await new Promise<void>((resolve, reject) => {
      void Filesystem.readFileInChunks(
        {
          path: APK_CACHE_NAME,
          directory: Directory.Cache,
          chunkSize: HASH_CHUNK_BYTES,
        },
        (chunk, err) => {
          if (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
            return;
          }
          if (!chunk || chunk.data == null || chunk.data === '') {
            resolve();
            return;
          }
          if (typeof chunk.data === 'string') {
            const part = base64ToBytes(chunk.data);
            hasher.update(part);
            bytes += part.length;
          }
        }
      ).catch(reject);
    });
    if (bytes === 0) throw new Error('APK 下载为空');
    return bytesToHex(hasher.digest());
  }

  const bytes = await cachedApkBytes();
  if (!bytes || bytes.length === 0) throw new Error('APK 下载为空');
  return sha256HexOf(bytes);
}

async function downloadNative(url: string, onProgress?: DownloadProgress): Promise<void> {
  await deleteCachedApk();
  let handle: PluginListenerHandle | undefined;
  try {
    if (onProgress) {
      handle = await Filesystem.addListener('progress', (ev) => {
        if (ev.url && ev.url !== url) return;
        onProgress(ev.bytes, ev.contentLength || ev.bytes);
      });
    }
    await Filesystem.downloadFile({
      url,
      path: APK_CACHE_NAME,
      directory: Directory.Cache,
      recursive: true,
      progress: Boolean(onProgress),
    });
  } finally {
    await handle?.remove();
  }
}

function matchesSha(actual: string, expected: string | undefined): boolean {
  return !expected || actual.toLowerCase() === expected.toLowerCase();
}

async function downloadWeb(
  url: string,
  expectedSha256: string | undefined,
  onProgress?: DownloadProgress
): Promise<string> {
  let prefix: Uint8Array | null = null;
  if (expectedSha256 && partialSha256 === expectedSha256) {
    prefix = await cachedApkBytes();
  } else {
    await deleteCachedApk();
  }
  partialSha256 = expectedSha256 ?? null;

  const startOffset = prefix?.length ?? 0;
  let hasher = new Sha256();
  if (prefix) {
    hasher.update(prefix);
  }

  let pending: Uint8Array = new Uint8Array();
  let wroteAny = startOffset > 0;

  await streamFetchBytes(
    url,
    async (chunk, loaded, total) => {
      hasher.update(chunk);
      pending = concatBytes(pending, chunk);
      if (pending.length >= WRITE_CHUNK_BYTES) {
        await appendChunk(pending, !wroteAny);
        wroteAny = true;
        pending = new Uint8Array();
      }
      onProgress?.(loaded, total || loaded);
    },
    {
      startOffset,
      onStart: (resumed) => {
        if (!resumed && startOffset > 0) {
          // Server ignored the Range header and restarted the body.
          hasher = new Sha256();
          wroteAny = false;
          onProgress?.(0, 0);
        }
      },
    }
  );

  if (pending.length > 0) {
    await appendChunk(pending, !wroteAny);
  }
  if (!wroteAny && pending.length === 0) {
    throw new Error('APK 下载为空');
  }
  return bytesToHex(hasher.digest());
}

function toCandidates(input: string[] | string): string[] {
  const list = Array.isArray(input) ? input : [input];
  return list.filter((url) => Boolean(url));
}

/**
 * Downloads the APK into cache and verifies SHA-256 against version.json.
 * Mirrors are tried in order; within a mirror the web path resumes with Range,
 * while native restarts through `Filesystem.downloadFile`. A candidate only
 * counts as successful once its hash matches.
 */
export async function downloadApkToCache(
  candidates: string[] | string,
  expectedSha256: string | undefined,
  onProgress?: DownloadProgress,
  onMirror?: (index: number, total: number) => void
): Promise<string> {
  const urls = toCandidates(candidates);
  if (urls.length === 0) {
    throw new Error('no APK download candidate');
  }

  let lastError: unknown;
  for (let i = 0; i < urls.length; i++) {
    onMirror?.(i, urls.length);
    const url = urls[i]!;
    try {
      await retry(
        async () => {
          const hash = Capacitor.isNativePlatform()
            ? await (async () => {
                await downloadNative(url, onProgress);
                return hashCachedApk();
              })()
            : await downloadWeb(url, expectedSha256, onProgress);
          if (!matchesSha(hash, expectedSha256)) {
            throw new UpdateHttpError('APK 校验失败（SHA-256 不匹配）', 0);
          }
        },
        UPDATE_TIMEOUT.RETRY_ATTEMPTS,
        UPDATE_TIMEOUT.RETRY_INTERVAL_MS,
        (e) => !(e instanceof UpdateHttpError)
      );
      partialSha256 = null;
      return APK_CACHE_NAME;
    } catch (e) {
      lastError = e;
      // Transient transport failures keep the `.part` file so the next mirror resumes.
      if (e instanceof UpdateHttpError) {
        await deleteCachedApk();
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('APK 下载失败');
}

export async function getCachedApkUri(): Promise<string> {
  const {uri} = await Filesystem.getUri({
    path: APK_CACHE_NAME,
    directory: Directory.Cache,
  });
  return uri;
}
