import {Capacitor} from '@capacitor/core';
import {Directory, Filesystem} from '@capacitor/filesystem';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createRuntime} from '../../core/download/runtime';
import {DocCacheEntry} from './types';

export const DEFAULT_SCALE = 1.2;

const CACHE_LIMIT = 3;
const docCache = new Map<string, DocCacheEntry>();

function cacheEntry(filePath: string, entry: DocCacheEntry): void {
  docCache.delete(filePath);
  docCache.set(filePath, entry);
  while (docCache.size > CACHE_LIMIT) {
    const oldest = docCache.keys().next().value as string;
    const evicted = docCache.get(oldest);
    docCache.delete(oldest);
    void evicted?.task.destroy();
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

async function readPdfBytes(filePath: string): Promise<Uint8Array> {
  if (Capacitor.isNativePlatform()) {
    const r = await Filesystem.readFile({
      path: filePath,
      directory: Directory.Documents,
    });
    if (typeof r.data === 'string') {
      return base64ToBytes(r.data);
    }
    return new Uint8Array(await r.data.arrayBuffer());
  }
  const runtime = createRuntime();
  return runtime.fs.readFile(filePath);
}

const INITIAL_DATA_LEN = 64 * 1024;
const RANGE_CHUNK_SIZE = 256 * 1024;

class CapacitorPdfRangeTransport extends pdfjs.PDFDataRangeTransport {
  private readonly filePath: string;

  constructor(filePath: string, length: number, initialData: Uint8Array) {
    super(length, initialData);
    this.filePath = filePath;
  }

  override async requestDataRange(begin: number, end: number): Promise<void> {
    try {
      const r = await Filesystem.readFile({
        path: this.filePath,
        directory: Directory.Documents,
        offset: begin,
        length: end - begin,
      });
      this.onDataRange(
        begin,
        typeof r.data === 'string'
          ? base64ToBytes(r.data)
          : new Uint8Array(await r.data.arrayBuffer()),
      );
    } catch {
      this.onDataRange(begin, new Uint8Array(0));
    }
  }
}

async function loadNativeRange(filePath: string): Promise<DocCacheEntry> {
  const stat = await Filesystem.stat({
    path: filePath,
    directory: Directory.Documents,
  });
  const head = await Filesystem.readFile({
    path: filePath,
    directory: Directory.Documents,
    offset: 0,
    length: Math.min(stat.size, INITIAL_DATA_LEN),
  });
  const initialData =
    typeof head.data === 'string'
      ? base64ToBytes(head.data)
      : new Uint8Array(await head.data.arrayBuffer());
  const range = new CapacitorPdfRangeTransport(filePath, stat.size, initialData);
  const task = pdfjs.getDocument({range, rangeChunkSize: RANGE_CHUNK_SIZE});
  const doc = await task.promise;
  return {doc, task, numPages: doc.numPages, page: 1, scale: DEFAULT_SCALE};
}

export async function loadDoc(filePath: string): Promise<DocCacheEntry> {
  const cached = docCache.get(filePath);
  if (cached) {
    docCache.delete(filePath);
    docCache.set(filePath, cached);
    return cached;
  }
  if (Capacitor.isNativePlatform()) {
    try {
      const entry = await loadNativeRange(filePath);
      cacheEntry(filePath, entry);
      return entry;
    } catch {
      // incremental range loading unsupported; fall back to full read
    }
  }
  const bytes = await readPdfBytes(filePath);
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const task = pdfjs.getDocument({data});
  const doc = await task.promise;
  const entry: DocCacheEntry = {doc, task, numPages: doc.numPages, page: 1, scale: DEFAULT_SCALE};
  cacheEntry(filePath, entry);
  return entry;
}

export function persistCacheEntry(filePath: string, doc: pdfjs.PDFDocumentProxy | null, page: number, scale: number): void {
  const entry = docCache.get(filePath);
  if (entry && entry.doc === doc) {
    entry.page = page;
    entry.scale = scale;
  }
}

export function getDocCache(filePath: string): DocCacheEntry | undefined {
  return docCache.get(filePath);
}

const LOW_RES_RATIO = 0.25;

let renderQueue: Promise<void> = Promise.resolve();

export function setPageContent(
  canvas: HTMLCanvasElement | null,
  doc: pdfjs.PDFDocumentProxy | null,
  num: number,
  s: number,
  seq: number,
  seqOf: () => number,
  onLowRes?: () => void,
): Promise<void> {
  const run = async () => {
    if (!doc || !canvas) return;
    const pdfPage = await doc.getPage(num);
    if (seq !== seqOf()) return;
    const ratio = window.devicePixelRatio || 1;
    const viewport = pdfPage.getViewport({scale: s});
    const w = Math.floor(viewport.width * ratio);
    const h = Math.floor(viewport.height * ratio);
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    const lowRes = pdfPage.getViewport({scale: s * LOW_RES_RATIO});
    const lw = Math.max(1, Math.floor(lowRes.width * ratio));
    const lh = Math.max(1, Math.floor(lowRes.height * ratio));
    const lowCanvas = document.createElement('canvas');
    lowCanvas.width = lw;
    lowCanvas.height = lh;
    await pdfPage.render({
      canvas: lowCanvas,
      viewport: lowRes,
      transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
    }).promise;
    if (seq !== seqOf()) return;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    ctx2d.drawImage(lowCanvas, 0, 0, w, h);
    onLowRes?.();
    if (seq !== seqOf()) return;
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    await pdfPage.render({
      canvas: tmp,
      viewport,
      transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
    }).promise;
    if (seq !== seqOf()) return;
    ctx2d.drawImage(tmp, 0, 0);
  };
  const p = renderQueue.then(run, run);
  renderQueue = p.catch(() => {});
  return p;
}
