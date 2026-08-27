import {Capacitor, registerPlugin} from '@capacitor/core';
import {base64ToBytes, bytesToBase64} from '../../core/util/base64';

export interface SafEntry {
  name: string;
  type: 'file' | 'directory';
}

export interface SafStoragePlugin {
  persistTreeUri(options: {uri: string}): Promise<void>;
  listDirectory(options: {treeUri: string; relativePath?: string}): Promise<{entries: SafEntry[]}>;
  readTextFile(options: {treeUri: string; relativePath: string}): Promise<{data: string}>;
  readBinaryFile(options: {treeUri: string; relativePath: string}): Promise<{data: string}>;
  getEntryUri(options: {treeUri: string; relativePath: string}): Promise<{uri: string}>;
  entryExists(options: {treeUri: string; relativePath: string}): Promise<{exists: boolean}>;
  ensureDirectory(options: {treeUri: string; relativePath?: string}): Promise<void>;
  writeFile(options: {treeUri: string; relativePath: string; data: string}): Promise<void>;
  deleteEntry(options: {treeUri: string; relativePath: string}): Promise<void>;
  deleteDirectory(options: {treeUri: string; relativePath: string}): Promise<void>;
}

const SafStorageNative = registerPlugin<SafStoragePlugin>('SafStorage');

export async function persistDownloadTreeUri(uri: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }
  await SafStorageNative.persistTreeUri({uri});
}

export async function safListDirectory(treeUri: string, relativePath = ''): Promise<SafEntry[]> {
  const {entries} = await SafStorageNative.listDirectory({treeUri, relativePath});
  return entries;
}

export async function safReadTextFile(treeUri: string, relativePath: string): Promise<string> {
  const {data} = await SafStorageNative.readTextFile({treeUri, relativePath});
  return data;
}

export async function safReadBinaryFile(treeUri: string, relativePath: string): Promise<Uint8Array> {
  const {data} = await SafStorageNative.readBinaryFile({treeUri, relativePath});
  return base64ToBytes(data);
}

export async function safGetEntryUri(treeUri: string, relativePath: string): Promise<string> {
  const {uri} = await SafStorageNative.getEntryUri({treeUri, relativePath});
  return uri;
}

export async function safEntryExists(treeUri: string, relativePath: string): Promise<boolean> {
  try {
    const {exists} = await SafStorageNative.entryExists({treeUri, relativePath});
    return exists;
  } catch {
    return false;
  }
}

export async function safFileExists(treeUri: string, relativePath: string): Promise<boolean> {
  return safEntryExists(treeUri, relativePath);
}

export async function safEnsureDirectory(treeUri: string, relativePath = ''): Promise<void> {
  await SafStorageNative.ensureDirectory({treeUri, relativePath});
}

export async function safWriteFile(
  treeUri: string,
  relativePath: string,
  data: Uint8Array
): Promise<void> {
  await SafStorageNative.writeFile({
    treeUri,
    relativePath,
    data: bytesToBase64(data),
  });
}

export async function safDeleteEntry(treeUri: string, relativePath: string): Promise<void> {
  await SafStorageNative.deleteEntry({treeUri, relativePath});
}

export async function safDeleteDirectory(treeUri: string, relativePath: string): Promise<void> {
  await SafStorageNative.deleteDirectory({treeUri, relativePath});
}
