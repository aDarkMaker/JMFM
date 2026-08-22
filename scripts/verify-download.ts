import {HttpClient} from '../src/core/net';
import {ApiClient} from '../src/core/api';
import {DownloadService} from '../src/core/download';
import {createNodeRuntime} from './node-runtime';

const ALBUM_ID = Number(process.argv[2] ?? 1327951);
const OUT_DIR = `${process.cwd()}/temp`;

function log(step: string, detail: string): void {
  console.log(`[${new Date().toISOString()}] ${step}: ${detail}`);
}

async function main(): Promise<void> {
  log('start', `album=${ALBUM_ID} full pdf`);
  const http = new HttpClient({
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
        break;
      case 'chapter':
        log('chapter', `${e.index}/${e.total}`);
        break;
      case 'image':
        if (e.downloaded === e.total || e.downloaded % 5 === 0) {
          log('image', `${e.downloaded}/${e.total}`);
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
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
