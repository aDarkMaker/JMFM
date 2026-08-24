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
  appendFile(path: string, data: Uint8Array): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  unlink(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  pickDirectory?(): Promise<string | null>;
  createDirectory?(path: string): Promise<void>;
}

export interface DownloadRuntime {
  fs: FileSystem;
  decodeAndSave(num: number, encoded: Uint8Array, ext: string): Promise<DecodedImage>;
  createAlbumPdf(
    outputDir: string,
    title: string,
    imagePaths: string[],
    sizes?: PageSize[],
  ): Promise<string>;
}
