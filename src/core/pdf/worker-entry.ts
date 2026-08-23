import {PDFDocument} from 'pdf-lib';
import type {PdfPage} from './index';

type WorkerMessage =
  | {type: 'init'; pages: PdfPage[]}
  | {type: 'image'; index: number; bytes: ArrayBuffer; ext: string}
  | {type: 'save'};

const ctx = self as unknown as {
  postMessage: (msg: unknown, transfer?: Transferable[]) => void;
  onmessage: ((e: MessageEvent) => void) | null;
};

let doc: PDFDocument | null = null;
let pages: PdfPage[] = [];
let queue: Promise<void> = Promise.resolve();

async function handleMsg(msg: WorkerMessage): Promise<void> {
  if (msg.type === 'init') {
    pages = msg.pages;
    doc = await PDFDocument.create();
    ctx.postMessage({type: 'ready'});
    return;
  }
  if (msg.type === 'image') {
    const page = pages[msg.index];
    const bytes = new Uint8Array(msg.bytes);
    const lower = (msg.ext || '').toLowerCase();
    const img =
      lower === 'jpg' || lower === 'jpeg'
        ? await doc!.embedJpg(bytes)
        : await doc!.embedPng(bytes);
    const p = doc!.addPage([page.width, page.height]);
    p.drawImage(img, {x: 0, y: 0, width: page.width, height: page.height});
    ctx.postMessage({type: 'page', index: msg.index});
    return;
  }
  if (msg.type === 'save') {
    const pdf = await doc!.save();
    const buf = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);
    ctx.postMessage({type: 'result', pdf: buf}, [buf]);
    doc = null;
    pages = [];
    return;
  }
}

ctx.onmessage = (e: MessageEvent) => {
  const msg = e.data as WorkerMessage;
  queue = queue.then(() => handleMsg(msg)).catch(err => {
    ctx.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  });
};
