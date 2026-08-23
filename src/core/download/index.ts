import {
  AlbumDetail,
  ImageItem,
  PhotoDetail,
  buildFallbackImageUrl,
  createImageItem,
} from '../model';
import {REQUEST} from '../constants';
import {HttpClient} from '../net';
import {getNum} from '../transcode';
import {DownloadRuntime} from './types';
import {calcConcurrency, decideImageStrategy, mapWithConcurrency} from './scheduler';
import {PageSize} from '../pdf/layout';

export type {DownloadRuntime, FileSystem, DecodedImage} from './types';

export type DownloadEvent =
  | {type: 'album-parsed'; title: string; chapters: number}
  | {type: 'chapter'; index: number; total: number; images: number}
  | {type: 'image'; downloaded: number; total: number; albumDone: number; albumTotal: number}
  | {type: 'pdf-start'}
  | {type: 'done'; pdfPath: string}
  | {type: 'canceled'}
  | {type: 'error'; message: string};

export interface ContentSource {
  getAlbum(albumId: number): Promise<AlbumDetail>;
  getPhoto(photoId: number): Promise<PhotoDetail>;
  buildImageItems(photo: PhotoDetail): ImageItem[];
}

export interface DownloadController {
  cancel(): void;
  paused: boolean;
}

export interface DownloadDeps {
  http: HttpClient;
  source: ContentSource;
  runtime: DownloadRuntime;
  downloadPath: string;
  concurrency?: number;
  cpuCount?: number;
}

class CanceledError extends Error {
  constructor() {
    super('canceled');
    this.name = 'CanceledError';
  }
}

export function isCanceledError(e: unknown): boolean {
  return e instanceof CanceledError;
}

const SUPPORTED_EXTS = ['webp', 'jpg', 'jpeg', 'png', 'gif'];

export class DownloadService {
  private deps: DownloadDeps;

  constructor(deps: DownloadDeps) {
    this.deps = deps;
  }

  async downloadAlbum(
    albumId: number,
    onEvent: (e: DownloadEvent) => void,
    opts?: {controller?: DownloadController},
  ): Promise<string> {
    const {runtime, source} = this.deps;
    const controller = opts?.controller;

    try {
      const album = await source.getAlbum(albumId);
      this.checkCanceled(controller);
      onEvent({type: 'album-parsed', title: album.name, chapters: album.episodes.length});

      const safeName = album.name.replace(/[/\\:*?"<>|]/g, '_');
      const albumDir = `${this.deps.downloadPath}/${safeName}`;
      const tempDir = `${albumDir}/.tmp`;

      await runtime.fs.mkdir(albumDir).catch(() => undefined);
      await runtime.fs.mkdir(tempDir).catch(() => undefined);

      const totalChapters = album.episodes.length;
      const pages: string[] = [];
      const pageSizes: PageSize[] = [];
      let albumDone = 0;
      let albumTotal = 0;

      for (let i = 0; i < totalChapters; i++) {
        this.checkCanceled(controller);
        const ep = album.episodes[i];
        const photo = await source.getPhoto(ep.photoId);
        this.checkCanceled(controller);
        if (!photo.scrambleId && album.scrambleId) {
          photo.scrambleId = album.scrambleId;
        }
        const imageItems = source.buildImageItems(photo);
        albumTotal += imageItems.length;
        onEvent({type: 'chapter', index: i + 1, total: totalChapters, images: imageItems.length});
        const chapter = await this.downloadChapter(
          imageItems,
          tempDir,
          i,
          onEvent,
          controller,
          albumDone,
          albumTotal,
        );
        pages.push(...chapter.paths);
        pageSizes.push(...chapter.sizes);
        albumDone += chapter.done;
      }

      onEvent({type: 'pdf-start'});
      const pdfPath = await runtime.createAlbumPdf(
        albumDir,
        album.name,
        pages,
        pageSizes,
      );
      this.checkCanceled(controller);
      await runtime.fs.unlink(tempDir).catch(() => undefined);
      onEvent({type: 'done', pdfPath});
      return pdfPath;
    } catch (e) {
      if (isCanceledError(e)) {
        onEvent({type: 'canceled'});
      } else {
        onEvent({
          type: 'error',
          message: e instanceof Error ? e.message : String(e),
        });
      }
      throw e;
    }
  }

  private checkCanceled(controller?: DownloadController): void {
    if (controller?.paused) {
      throw new CanceledError();
    }
  }

  private async downloadChapter(
    items: ImageItem[],
    tempDir: string,
    chapterIndex: number,
    onEvent: (e: DownloadEvent) => void,
    controller: DownloadController | undefined,
    albumDoneOffset: number,
    albumTotal: number,
  ): Promise<{paths: string[]; sizes: PageSize[]; done: number}> {
    const {http, runtime} = this.deps;
    const limit = calcConcurrency(
      items.length,
      this.deps.cpuCount ?? 4,
      this.deps.concurrency,
    );
    const pages = new Array<string>(items.length);
    const sizes = new Array<PageSize>(items.length);
    let done = 0;

    await mapWithConcurrency(items, limit, async (item, i) => {
      this.checkCanceled(controller);
      const base = `${tempDir}/${chapterIndex}_${String(i).padStart(4, '0')}`;
      const existing = await this.findExisting(base);
      if (existing) {
        pages[i] = existing;
        sizes[i] = {width: 0, height: 0};
        done += 1;
        onEvent({
          type: 'image',
          downloaded: done,
          total: items.length,
          albumDone: albumDoneOffset + done,
          albumTotal,
        });
        return;
      }
      const resp = await http.getBytes(item.url, {
        Referer: REQUEST.REFERER,
        Accept: REQUEST.ACCEPT_IMAGE,
      });
      this.checkCanceled(controller);
      if (!resp.ok || !resp.bytes) {
        throw new Error(`failed to download ${item.url}`);
      }
      const num = getNum(item.scrambleId, item.aid, item.fileName);
      const strategy = decideImageStrategy(num, item.suffix);
      let ext = item.suffix;
      if (strategy === 'raw') {
        await runtime.fs.writeFile(`${base}.${item.suffix}`, resp.bytes);
        sizes[i] = {width: 0, height: 0};
      } else {
        const decoded = await runtime.decodeAndSave(
          num,
          resp.bytes,
          item.suffix,
        );
        ext = decoded.ext;
        await runtime.fs.writeFile(`${base}.${decoded.ext}`, decoded.bytes);
        sizes[i] = {width: decoded.width, height: decoded.height};
      }
      pages[i] = `${base}.${ext}`;
      done += 1;
      onEvent({
        type: 'image',
        downloaded: done,
        total: items.length,
        albumDone: albumDoneOffset + done,
        albumTotal,
      });
    });

    return {paths: pages, sizes, done};
  }

  private async findExisting(base: string): Promise<string | null> {
    for (const ext of SUPPORTED_EXTS) {
      const p = `${base}.${ext}`;
      try {
        if (await this.deps.runtime.fs.exists(p)) {
          return p;
        }
      } catch {
        // ignore
      }
    }
    return null;
  }
}

export function buildImageItemsFromPhoto(photo: PhotoDetail): ImageItem[] {
  if (photo.pageArr.length > 0) {
    return photo.pageArr.map((name, i) => createImageItem(photo, name, i));
  }
  return Array.from({length: photo.totalPics}, (_, i) => {
    const fileName = String(i + 1).padStart(5, '0');
    return {
      aid: photo.photoId,
      scrambleId: photo.scrambleId,
      url: buildFallbackImageUrl(photo.photoId, i + 1),
      fileName,
      suffix: 'jpg',
      index: i,
    };
  });
}
