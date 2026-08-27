import {Directory, Filesystem} from '@capacitor/filesystem';
import {bytesToBase64} from '../util/base64';
import {updateFetchBytes} from './http';

const APK_CACHE_NAME = 'JMFM-update.apk';

export type DownloadProgress = (loaded: number, total: number) => void;

export async function downloadApkToCache(
  url: string,
  onProgress?: DownloadProgress,
): Promise<string> {
  const bytes = await updateFetchBytes(url, onProgress);
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
