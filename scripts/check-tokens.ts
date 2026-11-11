/**
 * Design-token gate.
 *
 * Rules enforced for every stylesheet except `src/web/theme/index.css`:
 *  1. No bare colors (`#hex`, `rgb()`, `rgba()`, `hsl()`): use a token.
 *  2. No bare px in padding / margin / gap: use `--space-*` (1–3px optical nudges allowed).
 *  3. No `calc(var(--z-*) + N)`: layering must come from the `--z-*` scale.
 *
 * Escape hatch: put `token-ignore: <reason>` in a comment on the same line.
 *
 * Run with: bun scripts/check-tokens.ts
 */
import {readdirSync, readFileSync, existsSync} from 'node:fs';
import {join, relative} from 'node:path';

const ROOT = join(import.meta.dir, '..');
const THEME_DIR = join(ROOT, 'src/web/theme');
const SCAN_DIR = join(ROOT, 'src/web');

const SPACING_PROPS = /^(padding|margin|gap|row-gap|column-gap)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$/;
const OPTICAL_PX = new Set([0, 1, 2, 3]);
const IGNORE = /token-ignore\s*:\s*\S/;

const errors: string[] = [];
const fail = (file: string, line: number, message: string) => {
  errors.push(`${relative(ROOT, file)}:${line} ${message}`);
};

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'generated') continue;
      out.push(...walk(full));
    } else if (entry.name.endsWith('.module.css') || entry.name.endsWith('.css')) {
      out.push(full);
    }
  }
  return out;
}

function isThemeFile(file: string): boolean {
  return file.startsWith(THEME_DIR);
}

function checkColor(file: string, index: number, line: string): void {
  const color = /#[0-9a-fA-F]{3,8}\b/.exec(line) ?? /\b(rgba?|hsla?)\s*\(/.exec(line);
  if (color) {
    fail(file, index + 1, `bare color "${color[0]}" — use a theme token`);
  }
}

function checkSpacing(file: string, index: number, line: string): void {
  const decl = /^\s*([a-z-]+)\s*:\s*(.+)$/i.exec(line);
  if (!decl) return;
  const prop = decl[1].toLowerCase();
  if (!SPACING_PROPS.test(prop)) return;
  const value = decl[2];
  if (/(calc|max|min|clamp|var)\(/.test(value)) return;
  for (const m of value.matchAll(/(-?\d*\.?\d+)px/g)) {
    const px = Math.abs(Number(m[1]));
    if (!OPTICAL_PX.has(px)) {
      fail(file, index + 1, `bare ${m[1]}px in ${prop} — use a --space-* token`);
      return;
    }
  }
}

function checkZIndex(file: string, index: number, line: string): void {
  if (/calc\(\s*var\(--z-[a-z-]+\)\s*[+-]\s*\d/.test(line)) {
    fail(file, index + 1, 'calc(var(--z-*) ± N) — add a dedicated --z-* token instead');
  }
}

for (const file of walk(SCAN_DIR)) {
  if (isThemeFile(file)) continue;
  const lines = readFileSync(file, 'utf-8').split('\n');
  lines.forEach((line, index) => {
    if (IGNORE.test(line)) return;
    checkColor(file, index, line);
    checkSpacing(file, index, line);
    checkZIndex(file, index, line);
  });
}

if (errors.length > 0) {
  console.error(`check-tokens: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log('check-tokens: OK');
