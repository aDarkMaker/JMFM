import {Directory, Filesystem} from '@capacitor/filesystem';
import {bytesToBase64} from '../util/base64';
import {Sha256, bytesToHex} from '../util/sha256';
import {streamFetchBytes} from './http';
import {UPDATE_TIMEOUT} from './constants';
import {retry} from '../net/retry';

const APK_CACHE_NAME = 'JMFM-update.apk';

/** Write batch: accumulate before each native write to balance bridge calls and memory. */
const WRITE_CHUNK_BYTES = 1024 * 1024;

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

/**
 * Streams the APK to cache while incrementally verifying SHA-256: chunks are received and
 * written incrementally so base64/bytes/hash copies never all stay in memory at once.
 */
export async function downloadApkToCache(
  url: string,
  expectedSha256: string | undefined,
  onProgress?: DownloadProgress
): Promise<string> {
  let actualHash = '';
  await retry(
    async () => {
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
      actualHash = bytesToHex(hasher.digest());
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
