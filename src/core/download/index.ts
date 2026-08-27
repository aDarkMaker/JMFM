import {
  AlbumDetail,
  ImageItem,
  PhotoDetail,
} from '../model';
import {REQUEST} from '../constants';
import {HttpClient, sleep} from '../net';
import {getNum} from '../transcode';
import {DownloadRuntime, DecodeFormat} from './types';
import {calcConcurrency, decideImageStrategy, mapWithConcurrency} from './scheduler';
import {PageSize} from '../pdf/layout';

export type {DownloadRuntime, FileSystem, DecodedImage} from './types';

export type DownloadEvent =
  | {type: 'album-parsed'; title: string; chapters: number; author: string; tags: string[]}
  | {type: 'chapter'; index: number; total: number; images: number}
  | {type: 'image'; downloaded: number; total: number; albumDone: number; albumTotal: number}
  | {type: 'done'; albumDir: string}
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
  imageFormat?: DecodeFormat;
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
      onEvent({type: 'album-parsed', title: album.name, chapters: album.episodes.length, author: album.author, tags: album.tags});

      const safeName = album.name.replace(/[/\\:*?"<>|]/g, '_');
      const albumDir = `${this.deps.downloadPath}/${safeName}`;
      const pagesDir = `${albumDir}/pages`;

      await runtime.fs.mkdir(albumDir).catch(() => undefined);
      await runtime.fs.mkdir(pagesDir).catch(() => undefined);
      await runtime.fs
        .writeFile(`${albumDir}/.nomedia`, new Uint8Array([0x0a]))
        .catch(() => undefined);

      const totalChapters = album.episodes.length;
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
          pagesDir,
          onEvent,
          controller,
          albumDone,
          albumTotal,
        );
        albumDone += chapter.done;
      }

      this.checkCanceled(controller);
      onEvent({type: 'done', albumDir});
      return albumDir;
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
    pagesDir: string,
    onEvent: (e: DownloadEvent) => void,
    controller: DownloadController | undefined,
    albumDoneOffset: number,
    albumTotal: number,
  ): Promise<{paths: string[]; sizes: PageSize[]; done: number}> {
    const {runtime} = this.deps;
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
      const base = `${pagesDir}/${String(albumDoneOffset + i + 1).padStart(4, '0')}`;
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
      const resp = await this.fetchImageBytes(item, controller);
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
          this.deps.imageFormat,
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

  private async fetchImageBytes(
    item: ImageItem,
    controller: DownloadController | undefined,
  ): Promise<{bytes: Uint8Array}> {
    const {http} = this.deps;
    let last: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      this.checkCanceled(controller);
      const resp = await http.getBytes(item.url, {
        Referer: REQUEST.REFERER,
        Accept: REQUEST.ACCEPT_IMAGE,
      });
      this.checkCanceled(controller);
      if (resp.ok && resp.bytes) {
        return {bytes: resp.bytes};
      }
      last = new Error(`failed to download ${item.url}`);
      if (attempt < 2) {
        await sleep(500);
      }
    }
    throw last;
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
