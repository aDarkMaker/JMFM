import {decodeAndSave} from '../../core/transcode/decode';
import {base64ToBytes} from '../../core/util/base64';
import type {DownloadRuntime} from '../../core/download';
import type {FileSystem} from '../../core/fs/types';
import {toSafRelativePath} from '../../core/fs/saf/safPaths';
import {
  safDeleteDirectory,
  safEnsureDirectory,
  safEntryExists,
  safGetEntrySize,
  safReadBinaryFile,
  safRename,
  safWriteFile,
} from '../../core/fs/saf/safStorage';

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
      const chunk = typeof data === 'string' ? base64ToBytes(data) : data;
      const prev = (await safEntryExists(treeUri, rel))
        ? new Uint8Array(await safReadBinaryFile(treeUri, rel))
        : new Uint8Array();
      const merged = new Uint8Array(prev.length + chunk.length);
      merged.set(prev, 0);
      merged.set(chunk, prev.length);
      await safWriteFile(treeUri, rel, merged);
    },
    readFile: async (path) => safReadBinaryFile(treeUri, toRel(path)),
    unlink: async (path) => {
      const rel = toRel(path);
      if (!rel) {
        throw new Error(`refusing to delete download root: ${path}`);
      }
      await safDeleteDirectory(treeUri, rel);
    },
    rename: async (oldPath, newPath) => {
      await safRename(treeUri, toRel(oldPath), toRel(newPath));
    },
    size: async (path) => safGetEntrySize(treeUri, toRel(path)),
    exists: async (path) => safEntryExists(treeUri, toRel(path)),
  };
  return {
    fs,
    decodeAndSave,
  };
}
