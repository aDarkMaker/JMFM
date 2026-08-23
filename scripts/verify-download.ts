import {AxiosHttpClient} from '../src/core/net';
import {ApiClient} from '../src/core/api';
import {DownloadService} from '../src/core/download';
import {CDN_DOMAINS, REQUEST} from '../src/core/constants';
import {createNodeRuntime} from './node-runtime';
import {writeFileSync} from 'node:fs';

const ALBUM_ID = Number(process.argv[2] ?? 1327951);
const OUT_DIR = `${process.cwd()}/temp`;

function log(step: string, detail: string): void {
  console.log(`[${new Date().toISOString()}] ${step}: ${detail}`);
}

async function main(): Promise<void> {
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
        log('album', 'parsed');
        log('album-meta', JSON.stringify({
          albumId: ALBUM_ID,
          title: e.title,
          author: e.author,
          tags: e.tags,
          chapters: e.chapters,
        }));
        break;
      case 'chapter':
        log('chapter', `${e.index}/${e.total}`);
        break;
      case 'image':
        if (e.downloaded === e.total || e.downloaded % 5 === 0) {
          log('image', `${e.downloaded}/${e.total} (album ${e.albumDone}/${e.albumTotal})`);
        }
        break;
      case 'pdf-start':
        log('pdf', 'building');
        break;
      case 'done':
        log('done', e.pdfPath);
        break;
      case 'error':
        log('error', e.message);
        break;
    }
  });

  log('pdf', pdfPath);

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
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
