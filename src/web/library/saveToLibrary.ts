import {HttpClient} from '../../core/net';
import {DownloadRuntime} from '../../core/download';
import {preloadCovers} from './coverCache';
import {downloadCover} from './cover';
import {clearImageDocCache} from '../reader/image-doc';
import {atomicWrite} from '../../core/fs/write';
import type {LocalAlbumMeta} from './discoverLibrary';

const META_FILE = '.jmf-meta.json';

export interface AlbumInfo {
  title: string;
  chapters: number;
  author: string;
  tags: string[];
}

interface LibraryWriter {
  add(item: {
    albumId: number;
    title: string;
    author?: string;
    tags?: string[];
    chapterCount: number;
    pageCount: number;
    filePath: string;
    pagesDir?: string;
    coverPath?: string;
  }): void;
}

export async function saveToLibrary(
  albumId: number,
  info: AlbumInfo,
  pageCount: number,
  albumDir: string,
  http: HttpClient,
  runtime: DownloadRuntime,
  writer: LibraryWriter
): Promise<void> {
  let coverPath: string | undefined;
  try {
    coverPath = await downloadCover(http, runtime.fs, albumId, albumDir);
  } catch {
    // cover download failure is non-fatal
  }
  writer.add({
    albumId,
    title: info.title,
    author: info.author,
    tags: info.tags,
    chapterCount: info.chapters,
    pageCount,
    filePath: albumDir,
    pagesDir: `${albumDir}/pages`,
    coverPath,
  });
  await persistLocalMeta(runtime, albumDir, {
    albumId,
    title: info.title,
    author: info.author,
    tags: info.tags,
    chapterCount: info.chapters,
    pageCount,
    coverPath,
  });
  void preloadCovers([coverPath]);
  clearImageDocCache(`${albumDir}/pages`);
}

export async function writeLocalAlbumMeta(
  runtime: DownloadRuntime,
  albumDir: string,
  meta: LocalAlbumMeta
): Promise<void> {
  const text = JSON.stringify(meta);
  const bytes = new TextEncoder().encode(text);
  await atomicWrite(runtime.fs, `${albumDir}/${META_FILE}`, bytes).catch(() => undefined);
}

function persistLocalMeta(
  runtime: DownloadRuntime,
  albumDir: string,
  meta: LocalAlbumMeta
): Promise<void> {
  return writeLocalAlbumMeta(runtime, albumDir, meta);
}
