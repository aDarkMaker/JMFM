import {CDN_DOMAINS, REQUEST} from '../../core/constants';
import {HttpClient} from '../../core/net';
import {DownloadRuntime} from '../../core/download';
import {preloadCovers} from './coverCache';
import {clearImageDocCache, loadImageDocMeta} from '../reader/image-doc';

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
  writer: LibraryWriter,
): Promise<void> {
  let coverPath: string | undefined;
  try {
    for (const domain of CDN_DOMAINS) {
      const resp = await http.getBytes(
        `https://${domain}/media/albums/${albumId}_3x4.jpg`,
        {Referer: REQUEST.REFERER, Accept: REQUEST.ACCEPT_IMAGE},
      );
      if (!resp.ok || !resp.bytes) {
        continue;
      }
      const cover = `${albumDir}/cover.jpg`;
      await runtime.fs.writeFile(cover, resp.bytes);
      coverPath = cover;
      break;
    }
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
  void preloadCovers([coverPath]);
  const pagesDir = `${albumDir}/pages`;
  clearImageDocCache(pagesDir);
  void loadImageDocMeta(pagesDir).catch(() => undefined);
}
