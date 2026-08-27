import {PDFDocument} from 'pdf-lib';
import {
  buildFooter,
  buildHeader,
  buildPage,
  createWriterState,
  WriterState,
} from '@/core/pdf/writer';
import type {PdfPage} from '@/core/pdf';

const JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==';

function tinyJpeg(): Uint8Array {
  return Uint8Array.from(atob(JPEG_B64), (c) => c.charCodeAt(0));
}

function buildPdf(pages: PdfPage[]): Uint8Array {
  const state: WriterState = createWriterState();
  const parts: Uint8Array[] = [buildHeader(state, pages.length)];
  pages.forEach((page, i) => {
    parts.push(buildPage(state, i, page, tinyJpeg()));
  });
  parts.push(buildFooter(state));
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const page = (w: number, h: number): PdfPage => ({
  imagePath: 'x.jpg',
  imageFit: 'fill',
  width: w,
  height: h,
  backgroundColor: '#ffffff',
});

describe('pdf writer', () => {
  it('produces a parseable pdf with correct page sizes', async () => {
    const pdf = buildPdf([page(100, 200), page(100, 200), page(200, 100)]);
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(3);
    const sizes = doc.getPages().map((p) => [p.getWidth(), p.getHeight()]);
    expect(sizes).toEqual([
      [100, 200],
      [100, 200],
      [200, 100],
    ]);
  });

  it('handles a single page', async () => {
    const pdf = buildPdf([page(595, 842)]);
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
  });

  it('handles many pages', async () => {
    const pdf = buildPdf(Array.from({length: 120}, () => page(595, 842)));
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(120);
  });
});
