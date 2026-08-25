import {computeStrips} from './index';
import {PDF} from '../constants';
import {DecodedImage, DecodeFormat} from '../download/types';

const JPEG_QUALITY = 0.85;
const WEBP_QUALITY = 0.82;

function scaleDim(width: number, height: number): {width: number; height: number} {
  if (width <= PDF.MAX_WIDTH) {
    return {width, height};
  }
  const ratio = PDF.MAX_WIDTH / width;
  return {
    width: PDF.MAX_WIDTH,
    height: Math.round(height * ratio),
  };
}

function encodeParams(format: DecodeFormat): {mime: string; quality: number; ext: string} {
  if (format === 'webp') {
    return {mime: 'image/webp', quality: WEBP_QUALITY, ext: 'webp'};
  }
  return {mime: 'image/jpeg', quality: JPEG_QUALITY, ext: 'jpg'};
}

async function bitmapToBytes(
  bitmap: ImageBitmap,
  format: DecodeFormat,
): Promise<DecodedImage> {
  const canvas = document.createElement('canvas');
  const dim = scaleDim(bitmap.width, bitmap.height);
  canvas.width = dim.width;
  canvas.height = dim.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('canvas 2d context unavailable');
  }
  ctx.drawImage(bitmap, 0, 0, dim.width, dim.height);
  const {mime, quality, ext} = encodeParams(format);
  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, mime, quality),
  );
  if (!blob) {
    throw new Error(`${ext} encode failed`);
  }
  return {
    width: dim.width,
    height: dim.height,
    bytes: new Uint8Array(await blob.arrayBuffer()),
    ext,
  };
}

async function canvasToBytes(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  format: DecodeFormat,
): Promise<DecodedImage> {
  const dim = scaleDim(width, height);
  let out = canvas;
  if (dim.width !== width || dim.height !== height) {
    const scaled = document.createElement('canvas');
    scaled.width = dim.width;
    scaled.height = dim.height;
    const ctx = scaled.getContext('2d');
    if (!ctx) {
      throw new Error('canvas 2d context unavailable');
    }
    ctx.drawImage(canvas, 0, 0, dim.width, dim.height);
    out = scaled;
  }
  const {mime, quality, ext} = encodeParams(format);
  const blob = await new Promise<Blob | null>(resolve =>
    out.toBlob(resolve, mime, quality),
  );
  if (!blob) {
    throw new Error(`${ext} encode failed`);
  }
  return {
    width: dim.width,
    height: dim.height,
    bytes: new Uint8Array(await blob.arrayBuffer()),
    ext,
  };
}

export async function decodeAndSave(
  num: number,
  encoded: Uint8Array,
  ext: string,
  format: DecodeFormat = 'jpg',
): Promise<DecodedImage> {
  const lower = ext.toLowerCase();
  if (num <= 1 && lower !== 'webp' && lower !== 'gif') {
    return {
      width: 0,
      height: 0,
      bytes: encoded,
      ext: lower === 'jpg' || lower === 'jpeg' ? 'jpg' : lower,
    };
  }
  const blob = new Blob([encoded as BlobPart]);
  const bitmap = await createImageBitmap(blob);
  try {
    const width = bitmap.width;
    const height = bitmap.height;
    if (num <= 1 || num > height) {
      return bitmapToBytes(bitmap, format);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('canvas 2d context unavailable');
    }
    for (const strip of computeStrips(num, height)) {
      ctx.drawImage(
        bitmap,
        0,
        strip.ySrc,
        width,
        strip.height,
        0,
        strip.yDst,
        width,
        strip.height,
      );
    }
    return canvasToBytes(canvas, width, height, format);
  } finally {
    bitmap.close();
  }
}
