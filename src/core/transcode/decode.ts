import {computeStrips} from './index';
import {PDF} from '../constants';
import {DecodedImage} from '../download/types';

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

async function bitmapToPngBytes(bitmap: ImageBitmap): Promise<DecodedImage> {
  const canvas = document.createElement('canvas');
  const dim = scaleDim(bitmap.width, bitmap.height);
  canvas.width = dim.width;
  canvas.height = dim.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('canvas 2d context unavailable');
  }
  ctx.drawImage(bitmap, 0, 0, dim.width, dim.height);
  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) {
    throw new Error('png encode failed');
  }
  return {
    width: dim.width,
    height: dim.height,
    bytes: new Uint8Array(await blob.arrayBuffer()),
    ext: 'png',
  };
}

export async function decodeAndSave(
  num: number,
  encoded: Uint8Array,
  ext: string,
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
      return bitmapToPngBytes(bitmap);
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
    const blobOut = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (!blobOut) {
      throw new Error('png encode failed');
    }
    const dim = scaleDim(width, height);
    if (dim.width !== width || dim.height !== height) {
      const outCanvas = document.createElement('canvas');
      outCanvas.width = dim.width;
      outCanvas.height = dim.height;
      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) {
        throw new Error('canvas 2d context unavailable');
      }
      outCtx.drawImage(canvas, 0, 0, dim.width, dim.height);
      const resized = await new Promise<Blob | null>(resolve =>
        outCanvas.toBlob(resolve, 'image/png'),
      );
      if (!resized) {
        throw new Error('png encode failed');
      }
      return {
        width: dim.width,
        height: dim.height,
        bytes: new Uint8Array(await resized.arrayBuffer()),
        ext: 'png',
      };
    }
    return {
      width,
      height,
      bytes: new Uint8Array(await blobOut.arrayBuffer()),
      ext: 'png',
    };
  } finally {
    bitmap.close();
  }
}
