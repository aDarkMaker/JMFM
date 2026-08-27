import {Directory, Filesystem} from '@capacitor/filesystem';
import {bytesToBase64} from '../util/base64';
import {sha256Hex} from '../util/sha256';
import {updateFetchBytes} from './http';

const APK_CACHE_NAME = 'JMFM-update.apk';

export type DownloadProgress = (loaded: number, total: number) => void;

/**
 * Downloads the APK to cache and verifies its SHA-256 against the value
 * published in version.json before the installer ever sees it.
 */
export async function downloadApkToCache(
  url: string,
  expectedSha256: string | undefined,
  onProgress?: DownloadProgress,
): Promise<string> {
  const bytes = await updateFetchBytes(url, onProgress);
  if (expectedSha256) {
    const actual = await sha256Hex(bytes);
    if (actual.toLowerCase() !== expectedSha256.toLowerCase()) {
      throw new Error('APK 校验失败（SHA-256 不匹配）');
    }
  }
  await writeApk(bytes);
  return APK_CACHE_NAME;
}

async function writeApk(bytes: Uint8Array): Promise<void> {
  try {
    await Filesystem.deleteFile({
      path: APK_CACHE_NAME,
      directory: Directory.Cache,
    });
  } catch {
    // ignore missing file
  }
  await Filesystem.writeFile({
    path: APK_CACHE_NAME,
    directory: Directory.Cache,
    data: bytesToBase64(bytes),
  });
}

export async function getCachedApkUri(): Promise<string> {
  const {uri} = await Filesystem.getUri({
    path: APK_CACHE_NAME,
    directory: Directory.Cache,
  });
  return uri;
}
