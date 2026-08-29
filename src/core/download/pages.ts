import {AlbumDetail, ImageItem, IMAGE_EXTS} from '../model';
import {REQUEST} from '../constants';
import {HttpClient} from '../net';
import {retry} from '../net/retry';
import {getNum} from '../transcode';
import {base64ToBytes} from '../util/base64';
import {DownloadRuntime, DecodeFormat} from './types';
import {
  MEMORY_WATERMARK_BYTES,
  MemoryGate,
  Semaphore,
  calcConcurrency,
  calcDecodeConcurrency,
  decideImageStrategy,
  mapWithConcurrency,
} from './scheduler';
import {ContentSource, DownloadController} from './types';
import {MIN_FILE_BYTES} from '../fs/write';

export interface PagesContext {
  http: HttpClient;
  source: ContentSource;
  runtime: DownloadRuntime;
  concurrency?: number;
  cpuCount?: number;
  imageFormat?: DecodeFormat;
}

export interface PageProgress {
  done: number;
  total: number;
}

class CanceledError extends Error {
  constructor() {
    super('canceled');
    this.name = 'CanceledError';
  }
}

export {CanceledError};

export function isCanceledError(e: unknown): boolean {
  return e instanceof CanceledError;
}

/** Image response: native carries base64 (write-through, no decode), web carries bytes. */
export interface ImageBytes {
  bytes?: Uint8Array;
  base64?: string;
}

export function imageByteLength(image: ImageBytes): number {
  if (image.bytes) {
    return image.bytes.length;
  }
  return (image.base64?.length ?? 0) * 3 >> 2;
}

export function fetchImageBytes(
  http: HttpClient,
  item: ImageItem,
  checkCanceled?: () => void
): Promise<ImageBytes> {
  return retry(
    async () => {
      checkCanceled?.();
      const resp = await http.getBytes(item.url, {
        Referer: REQUEST.REFERER,
        Accept: REQUEST.ACCEPT_IMAGE,
      });
      checkCanceled?.();
      if (!resp.ok || (!resp.bytes && !resp.base64)) {
        throw new Error(`failed to download ${item.url}`);
      }
      return {bytes: resp.bytes, base64: resp.base64};
    },
    3,
    500,
    (e) => !isCanceledError(e)
  );
}

export async function findExisting(
  fs: DownloadRuntime['fs'],
  base: string
): Promise<string | null> {
  for (const ext of IMAGE_EXTS) {
    const p = `${base}.${ext}`;
    try {
      if ((await fs.size(p)) >= MIN_FILE_BYTES) {
        return p;
      }
    } catch {
      // ignore stat errors
    }
  }
  return null;
}

/** Collects every page item of an album across all episodes, in order. */
export async function collectAlbumPages(
  source: ContentSource,
  albumId: number
): Promise<{album: AlbumDetail; items: ImageItem[]}> {
  const album = await source.getAlbum(albumId);
  const items: ImageItem[] = [];
  for (const ep of album.episodes) {
    const photo = await source.getPhoto(ep.photoId);
    if (!photo.scrambleId && album.scrambleId) {
      photo.scrambleId = album.scrambleId;
    }
    items.push(...source.buildImageItems(photo));
  }
  return {album, items};
}

export interface DownloadPagesOptions {
  /** When set, only files with this extension count as existing; others are replaced. */
  preferredExt?: string;
}

/**
 * Downloads pages into pagesDir, skipping files that already exist.
 * Page filenames are zero-padded global indexes starting at `offset`.
 * Returns the number of pages written (existing files counted as done).
 */
async function writePageFile(
  fs: DownloadRuntime['fs'],
  path: string,
  data: Uint8Array | string
): Promise<void> {
  const tmp = `${path}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, path);
}

export async function downloadPages(
  ctx: PagesContext,
  items: ImageItem[],
  pagesDir: string,
  offset: number,
  controller?: DownloadController,
  onProgress?: (p: PageProgress) => void,
  opts?: DownloadPagesOptions
): Promise<number> {
  const {runtime} = ctx;
  const netLimit = calcConcurrency(items.length, ctx.cpuCount ?? 4, ctx.concurrency);
  const decodeGate = new Semaphore(calcDecodeConcurrency(ctx.cpuCount ?? 4));
  const memoryGate = new MemoryGate(MEMORY_WATERMARK_BYTES);
  let done = 0;
  const checkCanceled = () => {
    if (controller?.paused) {
      throw new CanceledError();
    }
  };

  await mapWithConcurrency(items, netLimit, async (item, i) => {
    checkCanceled();
    const base = `${pagesDir}/${String(offset + i + 1).padStart(4, '0')}`;
    const existing = await findExisting(runtime.fs, base);
    if (existing) {
      if (!opts?.preferredExt || existing.endsWith(`.${opts.preferredExt}`)) {
        done += 1;
        onProgress?.({done, total: items.length});
        return;
      }
      await runtime.fs.unlink(existing).catch(() => undefined);
    }
    const image = await fetchImageBytes(ctx.http, item, checkCanceled);
    checkCanceled();
    await memoryGate.acquire(imageByteLength(image));
    try {
      await decodeGate.acquire();
      try {
        checkCanceled();
        const num = getNum(item.scrambleId, item.aid, item.fileName);
        const strategy = decideImageStrategy(num, item.suffix);
        if (strategy === 'raw') {
          await writePageFile(
            runtime.fs,
            `${base}.${item.suffix}`,
            image.base64 ?? image.bytes!
          );
        } else {
          const encoded = image.bytes ?? base64ToBytes(image.base64!);
          const decoded = await runtime.decodeAndSave(num, encoded, item.suffix, ctx.imageFormat);
          await writePageFile(runtime.fs, `${base}.${decoded.ext}`, decoded.bytes);
        }
      } finally {
        decodeGate.release();
      }
    } finally {
      memoryGate.release(imageByteLength(image));
    }
    done += 1;
    onProgress?.({done, total: items.length});
  });

  return done;
}
