import {computeStrips} from './index';
import {DecodedImage} from '../download/types';

async function bitmapToPngBytes(bitmap: ImageBitmap): Promise<DecodedImage> {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('canvas 2d context unavailable');
  }
  ctx.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) {
    throw new Error('png encode failed');
  }
  return {
    width: bitmap.width,
    height: bitmap.height,
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
