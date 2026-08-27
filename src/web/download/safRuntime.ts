import {decodeAndSave} from '../../core/transcode/decode';
import {createAlbumPdf} from '../../core/download/runtime';
import type {DownloadRuntime} from '../../core/download';
import type {FileSystem} from '../../core/fs/types';
import {toSafRelativePath} from '../library/safPaths';
import {
  safDeleteDirectory,
  safEnsureDirectory,
  safEntryExists,
  safReadBinaryFile,
  safWriteFile,
} from '../library/safStorage';

export function createSafRuntime(treeUri: string, downloadPath: string): DownloadRuntime {
  const toRel = (path: string) => toSafRelativePath(path, downloadPath);
  const fs: FileSystem = {
    mkdir: async (path) => {
      await safEnsureDirectory(treeUri, toRel(path));
    },
    writeFile: async (path, data) => {
      await safWriteFile(treeUri, toRel(path), data);
    },
    appendFile: async (path, data) => {
      const rel = toRel(path);
      const prev = (await safEntryExists(treeUri, rel))
        ? new Uint8Array(await safReadBinaryFile(treeUri, rel))
        : new Uint8Array();
      const merged = new Uint8Array(prev.length + data.length);
      merged.set(prev, 0);
      merged.set(data, prev.length);
      await safWriteFile(treeUri, rel, merged);
    },
    readFile: async (path) => safReadBinaryFile(treeUri, toRel(path)),
    unlink: async (path) => {
      await safDeleteDirectory(treeUri, toRel(path));
    },
    exists: async (path) => safEntryExists(treeUri, toRel(path)),
  };
  return {
    fs,
    decodeAndSave,
    createAlbumPdf: (dir, title, paths, sizes) => createAlbumPdf(fs, dir, title, paths, sizes),
  };
}
