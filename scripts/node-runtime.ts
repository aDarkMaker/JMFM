import {spawnSync} from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  renameSync,
  statSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {computeStrips} from '../src/core/transcode';
import {DecodedImage, DownloadRuntime, FileSystem, DecodeFormat} from '../src/core/download/types';

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
  format: DecodeFormat = 'jpg'
): DecodedImage {
  const lower = ext.toLowerCase();
  const outExt = format === 'webp' ? 'webp' : 'jpg';
  const quality = format === 'webp' ? 82 : 85;
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
      const out = join(dir, `out.${outExt}`);
      runMagick([input, '-quality', String(quality), out]);
      const {width, height} = identifySize(out);
      return {width, height, bytes: new Uint8Array(readFileSync(out)), ext: outExt};
    }

    const {width, height} = identifySize(input);
    if (num > height) {
      const out = join(dir, `out.${outExt}`);
      runMagick([input, '-quality', String(quality), out]);
      return {width, height, bytes: new Uint8Array(readFileSync(out)), ext: outExt};
    }

    const strips = computeStrips(num, height);
    const parts: string[] = [];
    for (let i = 0; i < strips.length; i++) {
      const s = strips[i];
      const part = join(dir, `s${i}.png`);
      runMagick([input, '-crop', `${width}x${s.height}+0+${s.ySrc}`, '+repage', part]);
      parts.push(part);
    }
    const out = join(dir, `out.${outExt}`);
    runMagick([...parts, '-append', '+repage', '-quality', String(quality), out]);
    return {
      width,
      height,
      bytes: new Uint8Array(readFileSync(out)),
      ext: outExt,
    };
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

export function createNodeRuntime(): DownloadRuntime {
  const fs: FileSystem = {
    mkdir: async (path) => {
      mkdirSync(path, {recursive: true});
    },
    writeFile: async (path, data) => {
      writeFileSync(path, typeof data === 'string' ? Buffer.from(data, 'base64') : data);
    },
    appendFile: async (path, data) => {
      writeFileSync(path, typeof data === 'string' ? Buffer.from(data, 'base64') : data, {
        flag: 'a',
      });
    },
    readFile: async (path) => {
      return new Uint8Array(readFileSync(path));
    },
    unlink: async (path) => {
      rmSync(path, {recursive: true, force: true});
    },
    rename: async (oldPath, newPath) => {
      renameSync(oldPath, newPath);
    },
    size: async (path) => {
      try {
        return statSync(path).size;
      } catch {
        return -1;
      }
    },
    exists: async (path) => existsSync(path),
  };
  return {
    fs,
    decodeAndSave: async (num, encoded, ext, format) => decodeWithMagick(num, encoded, ext, format),
  };
}
