import {
  CanceledError,
  PagesContext,
  collectAlbumPages,
  downloadPages,
  isCanceledError,
} from './pages';
import {DownloadController} from './types';

export type {DownloadRuntime, FileSystem, DecodedImage} from './types';
export type {ContentSource, DownloadController} from './types';

export type DownloadEvent =
  | {type: 'album-parsed'; title: string; chapters: number; author: string; tags: string[]}
  | {type: 'chapter'; index: number; total: number; images: number}
  | {type: 'image'; downloaded: number; total: number; albumDone: number; albumTotal: number}
  | {type: 'done'; albumDir: string}
  | {type: 'canceled'}
  | {type: 'error'; message: string};

export interface DownloadDeps extends PagesContext {
  downloadPath: string;
}

export {isCanceledError};

export class DownloadService {
  private deps: DownloadDeps;

  constructor(deps: DownloadDeps) {
    this.deps = deps;
  }

  async downloadAlbum(
    albumId: number,
    onEvent: (e: DownloadEvent) => void,
    opts?: {controller?: DownloadController}
  ): Promise<string> {
    const {runtime, source} = this.deps;
    const controller = opts?.controller;

    try {
      const {album} = await collectAlbumPages(source, albumId);
      this.checkCanceled(controller);
      onEvent({
        type: 'album-parsed',
        title: album.name,
        chapters: album.episodes.length,
        author: album.author,
        tags: album.tags,
      });

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
        const done = await downloadPages(
          this.deps,
          imageItems,
          pagesDir,
          albumDone,
          controller,
          (p) =>
            onEvent({
              type: 'image',
              downloaded: p.done,
              total: imageItems.length,
              albumDone: albumDone + p.done,
              albumTotal,
            })
        );
        albumDone += done;
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
}
