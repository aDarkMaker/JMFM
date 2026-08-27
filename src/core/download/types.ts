import {PageSize} from '../pdf/layout';
import type {AlbumDetail, DecodeFormat, DecodedImage, PhotoDetail} from '../model';
import type {FileSystem} from '../fs/types';
import {ImageItem} from '../model';

export type {DecodeFormat, DecodedImage} from '../model';
export type {FileSystem} from '../fs/types';

export interface DownloadRuntime {
  fs: FileSystem;
  decodeAndSave(
    num: number,
    encoded: Uint8Array,
    ext: string,
    format?: DecodeFormat
  ): Promise<DecodedImage>;
  createAlbumPdf(
    outputDir: string,
    title: string,
    imagePaths: string[],
    sizes?: PageSize[]
  ): Promise<string>;
}

export interface ContentSource {
  getAlbum(albumId: number): Promise<AlbumDetail>;
  getPhoto(photoId: number): Promise<PhotoDetail>;
  buildImageItems(photo: PhotoDetail): ImageItem[];
}

export interface DownloadController {
  cancel(): void;
  paused: boolean;
}
