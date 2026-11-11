import type {AlbumDetail, DecodeFormat, DecodedImage, PhotoDetail} from '@/core/model';
import type {FileSystem} from '@/core/fs/types';
import type {ImageItem} from '@/core/model';

export type {DecodeFormat, DecodedImage} from '@/core/model';
export type {FileSystem} from '@/core/fs/types';

export interface DownloadRuntime {
  fs: FileSystem;
  decodeAndSave(
    num: number,
    encoded: Uint8Array,
    ext: string,
    format?: DecodeFormat
  ): Promise<DecodedImage>;
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
