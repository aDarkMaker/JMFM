import {CDN_DOMAINS, REQUEST} from '../../core/constants';
import {HttpClient} from '../../core/net';
import {DownloadRuntime} from '../../core/download';
import {useLibraryStore} from '../stores/library';
import {clearImageDocCache, loadImageDocMeta, prefetchPageSrcs} from '../reader/image-doc';

export interface AlbumInfo {
  title: string;
  chapters: number;
  author: string;
  tags: string[];
}

export async function saveToLibrary(
  albumId: number,
  info: AlbumInfo,
  pageCount: number,
  pdfPath: string,
  http: HttpClient,
  runtime: DownloadRuntime,
): Promise<void> {
  const albumDir = pdfPath.slice(0, pdfPath.lastIndexOf('/'));
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
  useLibraryStore.getState().add({
    albumId,
    title: info.title,
    author: info.author,
    tags: info.tags,
    chapterCount: info.chapters,
    pageCount,
    filePath: pdfPath,
    pagesDir: `${albumDir}/pages`,
    coverPath,
  });
  const pagesDir = `${albumDir}/pages`;
  clearImageDocCache(pagesDir);
  void loadImageDocMeta(pagesDir)
    .then(meta => prefetchPageSrcs(meta, [0, 1, 2, 3, 4, 5]))
    .catch(() => undefined);
}
