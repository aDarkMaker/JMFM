import {Directory, Filesystem} from '@capacitor/filesystem';
import {bytesToBase64} from '../util/base64';

const APK_CACHE_NAME = 'JMFM-update.apk';

export type DownloadProgress = (loaded: number, total: number) => void;

export async function downloadApkToCache(
  url: string,
  onProgress?: DownloadProgress,
): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`APK download failed: HTTP ${resp.status}`);
  }

  const total = Number(resp.headers.get('content-length') ?? 0);
  const reader = resp.body?.getReader();
  if (!reader) {
    const buf = await resp.arrayBuffer();
    await writeApk(new Uint8Array(buf));
    onProgress?.(buf.byteLength, buf.byteLength || 1);
    return APK_CACHE_NAME;
  }

  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      chunks.push(value);
      loaded += value.length;
      onProgress?.(loaded, total || loaded);
    }
  }

  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  await writeApk(merged);
  onProgress?.(loaded, total || loaded);
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
