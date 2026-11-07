import {Directory, Filesystem} from '@capacitor/filesystem';
import {Capacitor, type PluginListenerHandle} from '@capacitor/core';
import {bytesToBase64, base64ToBytes} from '../util/base64';
import {Sha256, bytesToHex, sha256HexOf} from '../util/sha256';
import {streamFetchBytes} from './http';
import {UPDATE_TIMEOUT} from './constants';
import {retry} from '../net/retry';

const APK_CACHE_NAME = 'JMFM-update.apk';

/** Write batch: accumulate before each native write to balance bridge calls and memory. */
const WRITE_CHUNK_BYTES = 1024 * 1024;
const HASH_CHUNK_BYTES = 1024 * 1024;

export type DownloadProgress = (loaded: number, total: number) => void;

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const merged = new Uint8Array(a.length + b.length);
  merged.set(a, 0);
  merged.set(b, a.length);
  return merged;
}

async function deleteCachedApk(): Promise<void> {
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

  const res = await Filesystem.readFile({
    path: APK_CACHE_NAME,
    directory: Directory.Cache,
  });
  const data = res.data;
  const bytes =
    typeof data === 'string'
      ? base64ToBytes(data)
      : data instanceof Blob
        ? new Uint8Array(await data.arrayBuffer())
        : new Uint8Array();
  if (bytes.length === 0) throw new Error('APK 下载为空');
  return sha256HexOf(bytes);
}

async function downloadNative(
  url: string,
  onProgress?: DownloadProgress
): Promise<void> {
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

async function downloadWeb(
  url: string,
  onProgress?: DownloadProgress
): Promise<string> {
  await deleteCachedApk();
  const hasher = new Sha256();
  let pending: Uint8Array = new Uint8Array();
  let wroteAny = false;
  await streamFetchBytes(url, async (chunk, loaded, total) => {
    hasher.update(chunk);
    pending = concatBytes(pending, chunk);
    if (pending.length >= WRITE_CHUNK_BYTES) {
      await appendChunk(pending, !wroteAny);
      wroteAny = true;
      pending = new Uint8Array();
    }
    onProgress?.(loaded, total || loaded);
  });
  if (pending.length > 0) {
    await appendChunk(pending, !wroteAny);
  }
  return bytesToHex(hasher.digest());
}

/**
 * Downloads the APK into cache and verifies SHA-256 against version.json.
 * Native uses Filesystem.downloadFile (follows redirects, no giant base64 bridge).
 */
export async function downloadApkToCache(
  url: string,
  expectedSha256: string | undefined,
  onProgress?: DownloadProgress
): Promise<string> {
  let actualHash = '';
  await retry(
    async () => {
      if (Capacitor.isNativePlatform()) {
        await downloadNative(url, onProgress);
        actualHash = await hashCachedApk();
      } else {
        actualHash = await downloadWeb(url, onProgress);
      }
    },
    UPDATE_TIMEOUT.RETRY_ATTEMPTS,
    UPDATE_TIMEOUT.RETRY_INTERVAL_MS
  );

  if (expectedSha256 && actualHash.toLowerCase() !== expectedSha256.toLowerCase()) {
    await deleteCachedApk();
    throw new Error('APK 校验失败（SHA-256 不匹配）');
  }
  return APK_CACHE_NAME;
}

export async function getCachedApkUri(): Promise<string> {
  const {uri} = await Filesystem.getUri({
    path: APK_CACHE_NAME,
    directory: Directory.Cache,
  });
  return uri;
}
