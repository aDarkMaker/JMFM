import {PDFDocument} from 'pdf-lib';
import {PDF} from '../constants';
import {computeUniformWidth, PageSize, scaleSize} from './layout';

export {sanitizeTitle, buildFileName} from './names';
export {computeUniformWidth, scaleSize} from './layout';
export type {PageSize} from './layout';

export interface PdfPage {
  imagePath: string;
  imageFit: 'contain' | 'fill';
  width: number;
  height: number;
  backgroundColor: string;
}

export function buildPdfPages(
  imagePaths: string[],
  sizes?: PageSize[],
): PdfPage[] {
  const known = (sizes ?? []).filter(s => s.width > 0 && s.height > 0);
  const targetW = computeUniformWidth(
    known.map(s => s.width),
    PDF.MAX_WIDTH,
  );
  return imagePaths.map((imagePath, i) => {
    const size = sizes?.[i];
    if (size && size.width > 0 && size.height > 0) {
      const scaled = scaleSize(size.width, size.height, targetW);
      return {
        imagePath,
        imageFit: 'fill',
        width: scaled.width,
        height: scaled.height,
        backgroundColor: PDF.BACKGROUND,
      };
    }
    return {
      imagePath,
      imageFit: 'contain',
      width: PDF.PAGE_WIDTH_PT,
      height: PDF.PAGE_HEIGHT_PT,
      backgroundColor: PDF.BACKGROUND,
    };
  });
}

export async function buildPdfBytes(
  pages: PdfPage[],
  readImage: (path: string) => Promise<Uint8Array>,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const page of pages) {
    const bytes = await readImage(page.imagePath);
    const lower = page.imagePath.toLowerCase();
    const img = lower.endsWith('.jpg') || lower.endsWith('.jpeg')
      ? await doc.embedJpg(bytes)
      : await doc.embedPng(bytes);
    const p = doc.addPage([page.width, page.height]);
    p.drawImage(img, {x: 0, y: 0, width: page.width, height: page.height});
  }
  return doc.save();
}
