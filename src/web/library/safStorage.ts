import {Capacitor, registerPlugin} from '@capacitor/core';

export interface SafEntry {
  name: string;
  type: 'file' | 'directory';
}

export interface SafStoragePlugin {
  persistTreeUri(options: {uri: string}): Promise<void>;
  listDirectory(options: {treeUri: string; relativePath?: string}): Promise<{entries: SafEntry[]}>;
  readTextFile(options: {treeUri: string; relativePath: string}): Promise<{data: string}>;
  getEntryUri(options: {treeUri: string; relativePath: string}): Promise<{uri: string}>;
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

export async function safGetEntryUri(treeUri: string, relativePath: string): Promise<string> {
  const {uri} = await SafStorageNative.getEntryUri({treeUri, relativePath});
  return uri;
}

export async function safFileExists(treeUri: string, relativePath: string): Promise<boolean> {
  try {
    await safGetEntryUri(treeUri, relativePath);
    return true;
  } catch {
    return false;
  }
}

export async function safEntryExists(treeUri: string, relativePath: string): Promise<boolean> {
  try {
    await safGetEntryUri(treeUri, relativePath);
    return true;
  } catch {
    return false;
  }
}
