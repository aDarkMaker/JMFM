/* eslint-disable no-bitwise */
import {Capacitor} from '@capacitor/core';
import {Directory, Filesystem} from '@capacitor/filesystem';
import {decodeAndSave} from '../transcode/decode';
import {base64ToBytes, bytesToBase64} from '../util/base64';
import {DownloadRuntime, FileSystem} from './types';

export type {DecodedImage, DownloadRuntime, FileSystem} from './types';

export function createNativeRuntime(): DownloadRuntime {
  const fs: FileSystem = {
    mkdir: (path) =>
      Filesystem.mkdir({
        path,
        directory: Directory.Documents,
        recursive: true,
      }),
    writeFile: async (path, data) => {
      await Filesystem.writeFile({
        path,
        data: typeof data === 'string' ? data : bytesToBase64(data),
        directory: Directory.Documents,
        recursive: true,
      });
    },
    appendFile: async (path, data) => {
      await Filesystem.appendFile({
        path,
        data: typeof data === 'string' ? data : bytesToBase64(data),
        directory: Directory.Documents,
      });
    },
    readFile: async (path) => {
      const r = await Filesystem.readFile({
        path,
        directory: Directory.Documents,
      });
      if (typeof r.data !== 'string') {
        return new Uint8Array(await r.data.arrayBuffer());
      }
      return base64ToBytes(r.data);
    },
    unlink: async (path) => {
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
    rename: async (oldPath, newPath) => {
      await Filesystem.rename({
        from: oldPath,
        to: newPath,
        directory: Directory.Documents,
      });
    },
    size: async (path) => {
      try {
        const r = await Filesystem.stat({path, directory: Directory.Documents});
        return typeof r.size === 'number' ? r.size : -1;
      } catch {
        return -1;
      }
    },
    exists: async (path) => {
      try {
        await Filesystem.stat({path, directory: Directory.Documents});
        return true;
      } catch {
        return false;
      }
    },
  };
  return {fs, decodeAndSave};
}

export function createWebRuntime(): DownloadRuntime {
  const mem = new Map<string, Uint8Array>();
  const fs: FileSystem = {
    mkdir: async () => undefined,
    writeFile: async (path, data) => {
      mem.set(path, typeof data === 'string' ? base64ToBytes(data) : data);
    },
    appendFile: async (path, data) => {
      const chunk = typeof data === 'string' ? base64ToBytes(data) : data;
      const prev = mem.get(path);
      if (!prev) {
        mem.set(path, chunk);
        return;
      }
      const merged = new Uint8Array(prev.length + chunk.length);
      merged.set(prev, 0);
      merged.set(chunk, prev.length);
      mem.set(path, merged);
    },
    readFile: async (path) => {
      const data = mem.get(path);
      if (!data) {
        throw new Error(`file not found: ${path}`);
      }
      return data;
    },
    unlink: async (path) => {
      mem.delete(path);
    },
    rename: async (oldPath, newPath) => {
      const data = mem.get(oldPath);
      if (!data) {
        throw new Error(`file not found: ${oldPath}`);
      }
      mem.set(newPath, data);
      mem.delete(oldPath);
    },
    size: async (path) => mem.get(path)?.length ?? -1,
    exists: async (path) => mem.has(path),
  };
  return {fs, decodeAndSave};
}

export function createRuntime(): DownloadRuntime {
  return Capacitor.isNativePlatform() ? createNativeRuntime() : createWebRuntime();
}
