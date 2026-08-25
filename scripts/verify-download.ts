import {AxiosHttpClient} from '../src/core/net';
import {ApiClient} from '../src/core/api';
import {DownloadService} from '../src/core/download';
import {CDN_DOMAINS, REQUEST} from '../src/core/constants';
import {createNodeRuntime} from './node-runtime';
import {writeFileSync, readdirSync, statSync, existsSync} from 'node:fs';
import {join, dirname} from 'node:path';

const ALBUM_ID = Number(process.argv[2] ?? 1327951);
const OUT_DIR = `${process.cwd()}/temp`;

function log(step: string, detail: string): void {
  console.log(`[${new Date().toISOString()}] ${step}: ${detail}`);
}

function ms(t0: number): string {
  return `${(performance.now() - t0).toFixed(0)}ms`;
}

function summarizePages(pagesDir: string): {
  pageCount: number;
  totalBytes: number;
  avgBytes: number;
} {
  if (!existsSync(pagesDir)) {
    return {pageCount: 0, totalBytes: 0, avgBytes: 0};
  }
  const files = readdirSync(pagesDir).filter(n => /\.(jpe?g|png|webp)$/i.test(n));
  let totalBytes = 0;
  for (const name of files) {
    totalBytes += statSync(join(pagesDir, name)).size;
  }
  return {
    pageCount: files.length,
    totalBytes,
    avgBytes: files.length ? Math.round(totalBytes / files.length) : 0,
  };
}

async function main(): Promise<void> {
  const tAll = performance.now();
  let tAlbum = 0;
  let tImages = 0;
  let tPdf = 0;
  let albumParsedAt = 0;
  let imagesDoneAt = 0;
  let pdfStartAt = 0;
  let lastChapterAt = 0;
  let title = '';
  let chapters = 0;

  log('start', `album=${ALBUM_ID} full pdf`);
  const http = new AxiosHttpClient({
    ...(process.env.JMF_PROXY ? {proxy: process.env.JMF_PROXY} : {}),
    timeoutMs: 15000,
    maxRetries: 2,
  });
  if (process.env.JMF_PROXY) {
    log('proxy', process.env.JMF_PROXY);
  }

  const api = new ApiClient(http);
  const runtime = createNodeRuntime();
  const service = new DownloadService({
    http,
    source: api,
    runtime,
    downloadPath: OUT_DIR,
    concurrency: 6,
    cpuCount: 4,
  });

  const pdfPath = await service.downloadAlbum(ALBUM_ID, e => {
    switch (e.type) {
      case 'album-parsed':
        albumParsedAt = performance.now();
        tAlbum = albumParsedAt - tAll;
        title = e.title;
        chapters = e.chapters;
        lastChapterAt = albumParsedAt;
        log('album', `parsed in ${tAlbum.toFixed(0)}ms`);
        log('album-meta', JSON.stringify({
          albumId: ALBUM_ID,
          title: e.title,
          author: e.author,
          tags: e.tags,
          chapters: e.chapters,
        }));
        break;
      case 'chapter': {
        const now = performance.now();
        const chapterMs = lastChapterAt ? now - lastChapterAt : 0;
        lastChapterAt = now;
        log('chapter', `${e.index}/${e.total} images=${e.images} (+${chapterMs.toFixed(0)}ms)`);
        break;
      }
      case 'image':
        if (e.downloaded === e.total || e.downloaded % 10 === 0) {
          log('image', `${e.downloaded}/${e.total} (album ${e.albumDone}/${e.albumTotal})`);
        }
        if (e.albumDone === e.albumTotal && e.albumTotal > 0) {
          imagesDoneAt = performance.now();
          tImages = imagesDoneAt - albumParsedAt;
        }
        break;
      case 'pdf-start':
        pdfStartAt = performance.now();
        if (!imagesDoneAt) {
          imagesDoneAt = pdfStartAt;
          tImages = imagesDoneAt - albumParsedAt;
        }
        log('pdf', `building (images phase ${tImages.toFixed(0)}ms)`);
        break;
      case 'done': {
        const doneAt = performance.now();
        tPdf = doneAt - pdfStartAt;
        log('done', `${e.pdfPath} (pdf ${tPdf.toFixed(0)}ms)`);
        break;
      }
      case 'error':
        log('error', e.message);
        break;
    }
  });

  log('pdf', pdfPath);
  const albumDir = dirname(pdfPath);
  const pagesDir = join(albumDir, 'pages');
  const pages = summarizePages(pagesDir);
  const pdfBytes = existsSync(pdfPath) ? statSync(pdfPath).size : 0;
  log(
    'summary',
    JSON.stringify({
      albumId: ALBUM_ID,
      title,
      chapters,
      albumDir,
      pagesDir,
      pageCount: pages.pageCount,
      pagesTotalBytes: pages.totalBytes,
      pagesAvgBytes: pages.avgBytes,
      pdfBytes,
      timingMs: {
        albumParsed: Math.round(tAlbum),
        images: Math.round(tImages),
        pdf: Math.round(tPdf),
        total: Math.round(performance.now() - tAll),
      },
    }),
  );

  const coverUrl = `https://${CDN_DOMAINS[0]}/media/albums/${ALBUM_ID}_3x4.jpg`;
  log('cover', `fetching ${coverUrl}`);
  let coverResp;
  for (const domain of CDN_DOMAINS) {
    coverResp = await http.getBytes(
      `https://${domain}/media/albums/${ALBUM_ID}_3x4.jpg`,
      {Referer: REQUEST.REFERER, Accept: REQUEST.ACCEPT_IMAGE},
    );
    if (coverResp.ok && coverResp.bytes) {
      break;
    }
  }
  if (coverResp?.ok && coverResp.bytes) {
    const coverPath = `${OUT_DIR}/${ALBUM_ID}_cover.jpg`;
    writeFileSync(coverPath, coverResp.bytes);
    log('cover', `ok (${coverResp.bytes.length} bytes) -> ${coverPath}`);
  } else {
    log('cover', `failed status=${coverResp?.status}${coverResp?.error ? ` err=${coverResp.error}` : ''}`);
  }
  log('finish', ms(tAll));
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
