import {AlbumDetail, ImageItem} from '../model';
import {REQUEST} from '../constants';
import {HttpClient, sleep} from '../net';
import {getNum} from '../transcode';
import {DownloadRuntime, DecodeFormat} from './types';
import {calcConcurrency, decideImageStrategy, mapWithConcurrency} from './scheduler';
import {ContentSource, DownloadController} from './types';

export const SUPPORTED_EXTS = ['webp', 'jpg', 'jpeg', 'png', 'gif'] as const;

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

export function fetchImageBytes(
  http: HttpClient,
  item: ImageItem,
  checkCanceled?: () => void,
): Promise<Uint8Array> {
  return (async () => {
    let last: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      checkCanceled?.();
      const resp = await http.getBytes(item.url, {
        Referer: REQUEST.REFERER,
        Accept: REQUEST.ACCEPT_IMAGE,
      });
      checkCanceled?.();
      if (resp.ok && resp.bytes) {
        return resp.bytes;
      }
      last = new Error(`failed to download ${item.url}`);
      if (attempt < 2) {
        await sleep(500);
      }
    }
    throw last;
  })();
}

export async function findExisting(
  fs: DownloadRuntime['fs'],
  base: string,
): Promise<string | null> {
  for (const ext of SUPPORTED_EXTS) {
    const p = `${base}.${ext}`;
    try {
      if (await fs.exists(p)) {
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
  albumId: number,
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
export async function downloadPages(
  ctx: PagesContext,
  items: ImageItem[],
  pagesDir: string,
  offset: number,
  controller?: DownloadController,
  onProgress?: (p: PageProgress) => void,
  opts?: DownloadPagesOptions,
): Promise<number> {
  const {runtime} = ctx;
  const limit = calcConcurrency(items.length, ctx.cpuCount ?? 4, ctx.concurrency);
  let done = 0;
  const checkCanceled = () => {
    if (controller?.paused) {
      throw new CanceledError();
    }
  };

  await mapWithConcurrency(items, limit, async (item, i) => {
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
    const bytes = await fetchImageBytes(ctx.http, item, checkCanceled);
    checkCanceled();
    const num = getNum(item.scrambleId, item.aid, item.fileName);
    const strategy = decideImageStrategy(num, item.suffix);
    if (strategy === 'raw') {
      await runtime.fs.writeFile(`${base}.${item.suffix}`, bytes);
    } else {
      const decoded = await runtime.decodeAndSave(
        num,
        bytes,
        item.suffix,
        ctx.imageFormat,
      );
      await runtime.fs.writeFile(`${base}.${decoded.ext}`, decoded.bytes);
    }
    done += 1;
    onProgress?.({done, total: items.length});
  });

  return done;
}
