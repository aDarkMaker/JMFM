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

function supportsOffscreenCanvas(): boolean {
  return typeof OffscreenCanvas !== 'undefined';
}

async function toJpegBytes(
  bytes: Uint8Array,
  width: number,
  height: number,
  background: string,
): Promise<Uint8Array | null> {
  if (!supportsOffscreenCanvas()) {
    return null;
  }
  try {
    const blob = new Blob([bytes as BlobPart]);
    const bitmap = await createImageBitmap(blob);
    try {
      const canvas = new OffscreenCanvas(width, height);
      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) {
        return null;
      }
      ctx2d.fillStyle = background;
      ctx2d.fillRect(0, 0, width, height);
      const ratio = Math.min(width / bitmap.width, height / bitmap.height);
      const dw = bitmap.width * ratio;
      const dh = bitmap.height * ratio;
      ctx2d.drawImage(bitmap, (width - dw) / 2, (height - dh) / 2, dw, dh);
      const outBlob = await canvas.convertToBlob({
        type: 'image/jpeg',
        quality: 0.85,
      });
      return new Uint8Array(await outBlob.arrayBuffer());
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

async function handleMsg(msg: WorkerMessage): Promise<void> {
  if (msg.type === 'init') {
    pages = msg.pages;
    doc = await PDFDocument.create();
    console.log('[pdf] worker ready');
    ctx.postMessage({type: 'ready'});
    return;
  }
  if (msg.type === 'image') {
    const page = pages[msg.index];
    const bytes = new Uint8Array(msg.bytes);
    const lower = (msg.ext || '').toLowerCase();
    const jpeg = await toJpegBytes(bytes, page.width, page.height, page.backgroundColor);
    if (jpeg) {
      const img = await doc!.embedJpg(jpeg);
      const p = doc!.addPage([page.width, page.height]);
      p.drawImage(img, {x: 0, y: 0, width: page.width, height: page.height});
    } else {
      console.warn('[pdf] no offscreen canvas, raw embed');
      const img =
        lower === 'jpg' || lower === 'jpeg'
          ? await doc!.embedJpg(bytes)
          : await doc!.embedPng(bytes);
      const p = doc!.addPage([page.width, page.height]);
      p.drawImage(img, {x: 0, y: 0, width: page.width, height: page.height});
    }
    ctx.postMessage({type: 'page', index: msg.index});
    return;
  }
  if (msg.type === 'save') {
    const pdf = await doc!.save();
    console.log('[pdf] worker saved');
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
