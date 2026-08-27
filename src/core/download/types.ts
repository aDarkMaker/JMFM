import {PageSize} from '../pdf/layout';
import type {DecodeFormat, DecodedImage} from '../model';
import type {FileSystem} from '../fs/types';

export type {DecodeFormat, DecodedImage} from '../model';
export type {FileSystem} from '../fs/types';

export interface DownloadRuntime {
  fs: FileSystem;
  decodeAndSave(
    num: number,
    encoded: Uint8Array,
    ext: string,
    format?: DecodeFormat,
  ): Promise<DecodedImage>;
  createAlbumPdf(
    outputDir: string,
    title: string,
    imagePaths: string[],
    sizes?: PageSize[],
  ): Promise<string>;
}
