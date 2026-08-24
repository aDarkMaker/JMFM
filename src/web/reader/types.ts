import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface ReaderTarget {
  filePath: string;
  title: string;
  pageCount?: number;
  pagesDir?: string;
}

export interface DocCacheEntry {
  doc: pdfjs.PDFDocumentProxy;
  task: pdfjs.PDFDocumentLoadingTask;
  numPages: number;
  page: number;
  scale: number;
}

export interface BackPageCache {
  page: number;
  scale: number;
}

export type TouchState =
  | {type: 'pan'; x: number; y: number}
  | {type: 'pinch'; dist: number; scale: number; focalY: number; baseScrollTop: number}
  | null;

export const SCALE_MIN = 0.3;
export const SCALE_MAX = 4;
export const FLIP_DURATION_MS = 250;

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
