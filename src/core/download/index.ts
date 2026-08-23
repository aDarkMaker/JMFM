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
  | {type: 'album-parsed'}
  | {type: 'chapter'; index: number; total: number}
  | {type: 'image'; downloaded: number; total: number}
  | {type: 'pdf-start'}
  | {type: 'done'; pdfPath: string}
  | {type: 'error'; message: string};

export interface ContentSource {
  getAlbum(albumId: number): Promise<AlbumDetail>;
  getPhoto(photoId: number): Promise<PhotoDetail>;
  buildImageItems(photo: PhotoDetail): ImageItem[];
}

export interface DownloadDeps {
  http: HttpClient;
  source: ContentSource;
  runtime: DownloadRuntime;
  downloadPath: string;
  concurrency?: number;
  cpuCount?: number;
}

export class DownloadService {
  private deps: DownloadDeps;

  constructor(deps: DownloadDeps) {
    this.deps = deps;
  }

  async downloadAlbum(
    albumId: number,
    onEvent: (e: DownloadEvent) => void,
  ): Promise<string> {
    const {runtime, source} = this.deps;
    const albumDir = `${this.deps.downloadPath}/${albumId}`;
    const tempDir = `${albumDir}/.tmp`;

    try {
      await runtime.fs.mkdir(albumDir).catch(() => undefined);
      await runtime.fs.mkdir(tempDir).catch(() => undefined);

      const album = await source.getAlbum(albumId);
      onEvent({type: 'album-parsed'});

      const totalChapters = album.episodes.length;
      const pages: string[] = [];
      const pageSizes: PageSize[] = [];
      for (let i = 0; i < totalChapters; i++) {
        const ep = album.episodes[i];
        onEvent({type: 'chapter', index: i + 1, total: totalChapters});
        const photo = await source.getPhoto(ep.photoId);
        if (!photo.scrambleId && album.scrambleId) {
          photo.scrambleId = album.scrambleId;
        }
        const imageItems = source.buildImageItems(photo);
        const chapter = await this.downloadChapter(
          imageItems,
          tempDir,
          i,
          onEvent,
        );
        pages.push(...chapter.paths);
        pageSizes.push(...chapter.sizes);
      }

      onEvent({type: 'pdf-start'});
      const pdfPath = await runtime.createAlbumPdf(
        albumDir,
        album.name,
        pages,
        pageSizes,
      );
      await runtime.fs.unlink(tempDir).catch(() => undefined);
      onEvent({type: 'done', pdfPath});
      return pdfPath;
    } catch (e) {
      onEvent({
        type: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }

  private async downloadChapter(
    items: ImageItem[],
    tempDir: string,
    chapterIndex: number,
    onEvent: (e: DownloadEvent) => void,
  ): Promise<{paths: string[]; sizes: PageSize[]}> {
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
      const path = `${tempDir}/${chapterIndex}_${String(i).padStart(4, '0')}`;
      const resp = await http.getBytes(item.url, {
        Referer: REQUEST.REFERER,
        Accept: REQUEST.ACCEPT_IMAGE,
      });
      if (!resp.ok || !resp.bytes) {
        throw new Error(`failed to download ${item.url}`);
      }
      const num = getNum(item.scrambleId, item.aid, item.fileName);
      const strategy = decideImageStrategy(num, item.suffix);
      let ext = item.suffix;
      if (strategy === 'raw') {
        await runtime.fs.writeFile(`${path}.${item.suffix}`, resp.bytes);
        sizes[i] = {width: 0, height: 0};
      } else {
        const decoded = await runtime.decodeAndSave(
          num,
          resp.bytes,
          item.suffix,
        );
        ext = decoded.ext;
        await runtime.fs.writeFile(`${path}.${decoded.ext}`, decoded.bytes);
        sizes[i] = {width: decoded.width, height: decoded.height};
      }
      pages[i] = `${path}.${ext}`;
      done += 1;
      onEvent({type: 'image', downloaded: done, total: items.length});
    });

    return {paths: pages, sizes};
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
