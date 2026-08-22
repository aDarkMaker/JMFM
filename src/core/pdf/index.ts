import {createPdf} from 'react-native-images-to-pdf';
import {PDF} from '../constants';
import {buildFileName} from './names';
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

export async function createAlbumPdf(
  outputDir: string,
  title: string,
  imagePaths: string[],
  sizes?: PageSize[],
): Promise<string> {
  const outputPath = `${outputDir}/${buildFileName(title)}`;
  return createPdf({outputPath, pages: buildPdfPages(imagePaths, sizes)});
}
