import {buildFileName} from './names';
import {buildPdfPages} from './index';
import type {PageSize} from './layout';
import type {FileSystem} from '../download/types';

interface ReadyMsg {
  type: 'ready';
}
interface PageMsg {
  type: 'page';
  index: number;
}
interface ResultMsg {
  type: 'result';
  pdf: ArrayBuffer;
}
interface ErrorMsg {
  type: 'error';
  message: string;
}

type WorkerResponse = ReadyMsg | PageMsg | ResultMsg | ErrorMsg;

function extFromPath(path: string): string {
  const m = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : 'png';
}

function createBridge(worker: Worker) {
  let resolver: ((r: WorkerResponse) => void) | null = null;
  worker.onmessage = (e: MessageEvent) => {
    const msg = e.data as WorkerResponse;
    const fn = resolver;
    resolver = null;
    fn?.(msg);
  };
  return {
    post: (msg: unknown, transfer?: Transferable[]) =>
      new Promise<WorkerResponse>(resolve => {
        resolver = resolve;
        worker.postMessage(msg, transfer ?? []);
      }),
  };
}

function workerUrl(): string {
  return new URL('./pdf-worker.js', document.baseURI).href;
}

export async function createWorkerPdf(
  fs: FileSystem,
  outputDir: string,
  title: string,
  imagePaths: string[],
  sizes?: PageSize[],
): Promise<string> {
  const pages = buildPdfPages(imagePaths, sizes);
  let worker: Worker | null = null;
  try {
    worker = new Worker(workerUrl(), {type: 'module'});
    const bridge = createBridge(worker);
    let resp = await bridge.post({type: 'init', pages});
    if (resp.type === 'error') {
      throw new Error(resp.message);
    }
    for (let i = 0; i < pages.length; i++) {
      const bytes = await fs.readFile(pages[i].imagePath);
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      resp = await bridge.post({type: 'image', index: i, bytes: buf, ext: extFromPath(pages[i].imagePath)}, [buf]);
      if (resp.type === 'error') {
        throw new Error(resp.message);
      }
    }
    resp = await bridge.post({type: 'save'});
    if (resp.type === 'error') {
      throw new Error(resp.message);
    }
    if (resp.type !== 'result') {
      throw new Error('unexpected worker response');
    }
    const pdf = new Uint8Array(resp.pdf);
    const outputPath = `${outputDir}/${buildFileName(title)}`;
    await fs.writeFile(outputPath, pdf);
    return outputPath;
  } finally {
    worker?.terminate();
  }
}
