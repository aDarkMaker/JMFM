import {ImageFormat, Skia} from '@shopify/react-native-skia';
import {computeStrips} from './index';
import {DecodedImage} from '../download/types';

export type {DecodedImage};

export function decodeAndSave(
  num: number,
  encoded: Uint8Array,
  ext: string,
): DecodedImage {
  const lower = ext.toLowerCase();
  if (num <= 1 && lower !== 'webp') {
    return {
      width: 0,
      height: 0,
      bytes: encoded,
      ext: lower === 'jpg' ? 'jpg' : lower,
    };
  }
  const data = Skia.Data.fromBytes(encoded);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) {
    throw new Error(`failed to decode image (.${ext})`);
  }
  const width = image.width();
  const height = image.height();
  if (num <= 1 || num > height) {
    return {width, height, bytes: image.encodeToBytes(ImageFormat.PNG, 95), ext: 'png'};
  }

  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!surface) {
    throw new Error('failed to create offscreen surface');
  }
  const canvas = surface.getCanvas();
  for (const strip of computeStrips(num, height)) {
    const src = Skia.XYWHRect(0, strip.ySrc, width, strip.height);
    const dst = Skia.XYWHRect(0, strip.yDst, width, strip.height);
    canvas.drawImageRect(image, src, dst, Skia.Paint());
  }
  const snapshot = surface.makeImageSnapshot();
  return {
    width,
    height,
    bytes: snapshot.encodeToBytes(ImageFormat.PNG, 95),
    ext: 'png',
  };
}
