/* eslint-disable no-bitwise */
import {Capacitor} from '@capacitor/core';
import {Directory, Filesystem} from '@capacitor/filesystem';
import {decodeAndSave} from '../transcode/decode';
import {buildFileName} from '../pdf/names';
import {buildPdfBytes, buildPdfPages, PageSize} from '../pdf';
import {createWorkerPdf} from '../pdf/worker';
import {base64ToBytes, bytesToBase64} from '../util/base64';
import {DownloadRuntime, FileSystem} from './types';

export type {DecodedImage, DownloadRuntime, FileSystem} from './types';

export function createAlbumPdf(
  fs: FileSystem,
  outputDir: string,
  title: string,
  imagePaths: string[],
  sizes?: PageSize[],
): Promise<string> {
  return (async () => {
    if (typeof Worker !== 'undefined') {
      try {
        return await createWorkerPdf(fs, outputDir, title, imagePaths, sizes);
      } catch {
        // fall back to main-thread build
      }
    }
    const pages = buildPdfPages(imagePaths, sizes);
    const bytes = await buildPdfBytes(pages, fs.readFile);
    const outputPath = `${outputDir}/${buildFileName(title)}`;
    await fs.writeFile(outputPath, bytes);
    return outputPath;
  })();
}

export function createNativeRuntime(): DownloadRuntime {
  const fs: FileSystem = {
    mkdir: path =>
      Filesystem.mkdir({
        path,
        directory: Directory.Documents,
        recursive: true,
      }),
    writeFile: async (path, data) => {
      await Filesystem.writeFile({
        path,
        data: bytesToBase64(data),
        directory: Directory.Documents,
        recursive: true,
      });
    },
    appendFile: async (path, data) => {
      await Filesystem.appendFile({
        path,
        data: bytesToBase64(data),
        directory: Directory.Documents,
      });
    },
    readFile: async path => {
      const r = await Filesystem.readFile({
        path,
        directory: Directory.Documents,
      });
      if (typeof r.data !== 'string') {
        return new Uint8Array(await r.data.arrayBuffer());
      }
      return base64ToBytes(r.data);
    },
    unlink: async path => {
      try {
        await Filesystem.deleteFile({path, directory: Directory.Documents});
      } catch {
        await Filesystem.rmdir({
          path,
          directory: Directory.Documents,
          recursive: true,
        });
      }
    },
    exists: async path => {
      try {
        await Filesystem.stat({path, directory: Directory.Documents});
        return true;
      } catch {
        return false;
      }
    },
  };
  return {
    fs,
    decodeAndSave,
    createAlbumPdf: (dir, title, paths, sizes) =>
      createAlbumPdf(fs, dir, title, paths, sizes),
  };
}

export function createWebRuntime(): DownloadRuntime {
  const mem = new Map<string, Uint8Array>();
  const fs: FileSystem = {
    mkdir: async () => undefined,
    writeFile: async (path, data) => {
      mem.set(path, data);
    },
    appendFile: async (path, data) => {
      const prev = mem.get(path);
      if (!prev) {
        mem.set(path, data);
        return;
      }
      const merged = new Uint8Array(prev.length + data.length);
      merged.set(prev, 0);
      merged.set(data, prev.length);
      mem.set(path, merged);
    },
    readFile: async path => {
      const data = mem.get(path);
      if (!data) {
        throw new Error(`file not found: ${path}`);
      }
      return data;
    },
    unlink: async path => {
      mem.delete(path);
    },
    exists: async path => mem.has(path),
  };
  return {
    fs,
    decodeAndSave,
    createAlbumPdf: (dir, title, paths, sizes) =>
      createAlbumPdf(fs, dir, title, paths, sizes),
  };
}

export function createRuntime(): DownloadRuntime {
  return Capacitor.isNativePlatform()
    ? createNativeRuntime()
    : createWebRuntime();
}
