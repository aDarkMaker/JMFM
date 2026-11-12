/**
 * Subsets the two display fonts down to the glyphs the UI can actually render.
 *
 * Both are decorative faces used only for titles/headers; anything outside the
 * subset falls back to `--font-body`, so a missing glyph degrades instead of
 * showing tofu. The full originals live in `fonts/source/` (never imported) so
 * the subset can be rebuilt after adding coverage.
 *
 * Requires fontTools (`pip install fonttools brotli`). Not part of `bun run check`.
 * Run with: `bun scripts/subset-fonts.ts`.
 */
import {copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const FONTS_DIR = join(import.meta.dir, '../src/web/assets/fonts');
const SOURCE_DIR = join(FONTS_DIR, 'source');
const WORK_DIR = join(import.meta.dir, '../temp/font-subset');

function range(start: number, end: number): string[] {
  const out: string[] = [];
  for (let c = start; c < end; c++) out.push(String.fromCharCode(c));
  return out;
}

function kana(): string[] {
  return [...range(0x3041, 0x3097), ...range(0x30a1, 0x30fb), ...range(0x31f0, 0x3200)];
}

/** JIS X 0208 level 1 kanji: Shift_JIS rows 0x88–0x98, i.e. ku 16–47. */
function jisLevel1(): string[] {
  const decoder = new TextDecoder('shift_jis');
  const out: string[] = [];
  for (let hi = 0x88; hi < 0x99; hi++) {
    for (let lo = 0x40; lo < 0xfd; lo++) {
      if (lo === 0x7f) continue;
      const ch = decoder.decode(new Uint8Array([hi, lo]));
      if ([...ch].length === 1 && ch !== '\ufffd' && /[\u4e00-\u9fff]/.test(ch)) out.push(ch);
    }
  }
  return out;
}

/** GB2312 level 1 hanzi (rows 0xB0–0xD7). */
function gbLevel1(): string[] {
  const decoder = new TextDecoder('gb2312');
  const out: string[] = [];
  for (let hi = 0xb0; hi < 0xd8; hi++) {
    for (let lo = 0xa1; lo < 0xff; lo++) {
      const ch = decoder.decode(new Uint8Array([hi, lo]));
      if ([...ch].length === 1 && ch !== '\ufffd') out.push(ch);
    }
  }
  return out;
}

function unique(chars: string[]): string {
  return [...new Set(chars)].sort().join('');
}

function subset(source: string, chars: string, out: string): void {
  const textFile = join(WORK_DIR, `${out}.txt`);
  writeFileSync(textFile, chars);
  const result = spawnSync(
    'pyftsubset',
    [
      join(SOURCE_DIR, source),
      `--text-file=${textFile}`,
      '--flavor=woff2',
      `--output-file=${join(FONTS_DIR, out)}`,
      '--layout-features=',
    ],
    {encoding: 'utf8'}
  );
  if (result.error) {
    throw new Error(`pyftsubset not found — pip install fonttools brotli (${result.error.message})`);
  }
  if (result.status !== 0) {
    throw new Error(`pyftsubset failed for ${source}: ${result.stderr}`);
  }
  const before = statSync(join(SOURCE_DIR, source)).size;
  const after = statSync(join(FONTS_DIR, out)).size;
  console.log(
    `${out}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB (${chars.length} chars)`
  );
}

mkdirSync(SOURCE_DIR, {recursive: true});
mkdirSync(WORK_DIR, {recursive: true});

// Keep an untouched copy so re-subsetting never compounds on a previous subset.
const ORIGINALS = ['nagino.woff2', 'AlimamaShuHeiTi-Bold.woff2'];
for (const name of ORIGINALS) {
  const src = join(SOURCE_DIR, name);
  if (!existsSync(src)) copyFileSync(join(FONTS_DIR, name), src);
}

const ASCII = range(0x20, 0x7f);
const CJK_PUNCT = range(0x3000, 0x3040);
const FULLWIDTH = range(0xff01, 0xff61);

subset('nagino.woff2', unique([...ASCII, ...CJK_PUNCT, ...kana(), ...jisLevel1()]), 'nagino.woff2');
subset(
  'AlimamaShuHeiTi-Bold.woff2',
  unique([...ASCII, ...CJK_PUNCT, ...FULLWIDTH, ...gbLevel1()]),
  'AlimamaShuHeiTi-Bold.woff2'
);

for (const name of ORIGINALS) {
  console.log(`${name}: ${readFileSync(join(FONTS_DIR, name)).length} bytes`);
}
