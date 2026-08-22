import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {computeStrips} from '../src/core/transcode';
import {buildFileName} from '../src/core/pdf/names';
import {computeUniformWidth} from '../src/core/pdf/layout';
import {PDF} from '../src/core/constants';
import {DecodedImage, DownloadRuntime, FileSystem} from '../src/core/download/types';

function runMagick(args: string[]): void {
  const r = spawnSync('magick', args, {encoding: 'utf8'});
  if (r.status !== 0) {
    throw new Error(`magick failed: ${r.stderr || r.stdout || args.join(' ')}`);
  }
}

function identifySize(path: string): {width: number; height: number} {
  const r = spawnSync('magick', ['identify', '-format', '%w %h', path], {
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    throw new Error(`identify failed: ${r.stderr}`);
  }
  const [width, height] = r.stdout.trim().split(/\s+/).map(Number);
  return {width, height};
}

export function decodeWithMagick(
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

  const dir = mkdtempSync(join(tmpdir(), 'jmf-decode-'));
  const input = join(dir, `in.${lower || 'bin'}`);
  writeFileSync(input, encoded);

  try {
    if (num <= 1) {
      const out = join(dir, 'out.png');
      runMagick([input, out]);
      const {width, height} = identifySize(out);
      return {width, height, bytes: new Uint8Array(readFileSync(out)), ext: 'png'};
    }

    const {width, height} = identifySize(input);
    if (num > height) {
      const out = join(dir, 'out.png');
      runMagick([input, out]);
      return {width, height, bytes: new Uint8Array(readFileSync(out)), ext: 'png'};
    }

    const strips = computeStrips(num, height);
    const parts: string[] = [];
    for (let i = 0; i < strips.length; i++) {
      const s = strips[i];
      const part = join(dir, `s${i}.png`);
      runMagick([
        input,
        '-crop',
        `${width}x${s.height}+0+${s.ySrc}`,
        '+repage',
        part,
      ]);
      parts.push(part);
    }
    const out = join(dir, 'out.png');
    runMagick([...parts, '-append', '+repage', out]);
    return {
      width,
      height,
      bytes: new Uint8Array(readFileSync(out)),
      ext: 'png',
    };
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

export async function createPdfWithMagick(
  outputDir: string,
  title: string,
  imagePaths: string[],
): Promise<string> {
  mkdirSync(outputDir, {recursive: true});
  const outputPath = join(outputDir, buildFileName(title));
  if (imagePaths.length === 0) {
    throw new Error('no images for pdf');
  }
  const widths = imagePaths.map(path => identifySize(path).width);
  const targetW = computeUniformWidth(widths, PDF.MAX_WIDTH);
  runMagick([
    ...imagePaths,
    '+repage',
    '-resize',
    `${targetW}x`,
    outputPath,
  ]);
  return outputPath;
}

export function createNodeRuntime(): DownloadRuntime {
  const fs: FileSystem = {
    mkdir: async path => {
      mkdirSync(path, {recursive: true});
    },
    writeFile: async (path, data) => {
      writeFileSync(path, data);
    },
    unlink: async path => {
      rmSync(path, {recursive: true, force: true});
    },
  };
  return {
    fs,
    decodeAndSave: decodeWithMagick,
    createAlbumPdf: createPdfWithMagick,
  };
}
