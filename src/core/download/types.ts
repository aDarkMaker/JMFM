import {PageSize} from '../pdf/layout';

export interface DecodedImage {
  width: number;
  height: number;
  bytes: Uint8Array;
  ext: string;
}

export interface FileSystem {
  mkdir(path: string): Promise<void>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  unlink(path: string): Promise<void>;
}

export interface DownloadRuntime {
  fs: FileSystem;
  decodeAndSave(num: number, encoded: Uint8Array, ext: string): DecodedImage;
  createAlbumPdf(
    outputDir: string,
    title: string,
    imagePaths: string[],
    sizes?: PageSize[],
  ): Promise<string>;
}
