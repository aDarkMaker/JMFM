/**
 * Validates src/web/assets/icons + src/web/generated/icons.ts.
 * Run with: bun scripts/check-icons.ts
 */
import {readdirSync, readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {execSync} from 'node:child_process';

const ROOT = join(__dirname, '..');
const iconsDir = join(ROOT, 'src/web/assets/icons');
const generatedFile = join(ROOT, 'src/web/generated/icons.ts');

/** Icons that may be unused until a follow-up wires them in. Keep this empty. */
const UNUSED_ALLOWLIST = new Set<string>();

const errors: string[] = [];
const fail = (msg: string) => errors.push(msg);

if (!existsSync(iconsDir)) {
  fail(`missing icons dir: ${iconsDir}`);
}

const files = existsSync(iconsDir)
  ? readdirSync(iconsDir)
      .filter((f) => f.endsWith('.svg'))
      .sort()
  : [];
const names = files.map((f) => f.replace(/\.svg$/, ''));

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const seenLower = new Map<string, string>();

type IconMeta = {paths: string; viewBox: string; fill: string};
const meta = new Map<string, IconMeta>();

for (const file of files) {
  const name = file.replace(/\.svg$/, '');
  if (!KEBAB.test(name)) {
    fail(`icon name is not kebab-case: ${file}`);
  }
  const lower = name.toLowerCase();
  const dupe = seenLower.get(lower);
  if (dupe) {
    fail(`case-insensitive duplicate icon: ${dupe}.svg / ${file}`);
  } else {
    seenLower.set(lower, name);
  }

  const xml = readFileSync(join(iconsDir, file), 'utf-8');
  const viewBox = /viewBox="([^"]+)"/.exec(xml)?.[1] ?? '';
  if (viewBox !== '0 0 24 24') {
    fail(`${file}: viewBox must be "0 0 24 24" (got "${viewBox}")`);
  }
  const fill = /fill="([^"]+)"/.exec(xml)?.[1] ?? '';
  if (!['currentColor', 'none'].includes(fill) && !/<path[^>]*fill="currentColor"/.test(xml)) {
    fail(`${file}: path fill should be currentColor`);
  }
  const paths = [...xml.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]).join('|');
  if (!paths) {
    fail(`${file}: no <path d="..."> found`);
  }
  meta.set(name, {paths, viewBox, fill});
}

const byPaths = new Map<string, string[]>();
for (const [name, m] of meta) {
  const list = byPaths.get(m.paths) ?? [];
  list.push(name);
  byPaths.set(m.paths, list);
}
for (const group of byPaths.values()) {
  if (group.length > 1) {
    fail(`duplicate path data: ${group.join(', ')}`);
  }
}

if (existsSync(generatedFile)) {
  const generated = readFileSync(generatedFile, 'utf-8');
  const exported = new Set(
    [...generated.matchAll(/^\s{2}(?:'([^']+)'|"([^"]+)"|([\w$]+)):/gm)].map(
      (m) => (m[1] ?? m[2] ?? m[3]) as string
    )
  );
  for (const name of names) {
    if (!exported.has(name)) fail(`generated/icons.ts is stale: missing ${name}`);
  }
  for (const name of exported) {
    if (!names.includes(name)) fail(`generated/icons.ts has removed icon: ${name}`);
  }
} else {
  fail(`missing generated file: ${generatedFile}`);
}

const sourceFiles = execSync(
  "rg -l --glob '!src/web/generated/**' --glob '!src/web/assets/**' . src",
  {cwd: ROOT, encoding: 'utf-8'}
)
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((f) => join(ROOT, f));
const sources = sourceFiles.map((f) => [f, readFileSync(f, 'utf-8')] as const);

for (const name of names) {
  const used = sources.some(([, text]) => text.includes(`'${name}'`) || text.includes(`"${name}"`));
  if (!used && !UNUSED_ALLOWLIST.has(name)) {
    fail(`unused icon: ${name} (wire it up or delete it)`);
  }
}

for (const [, text] of sources) {
  for (const m of text.matchAll(/<Icon\s+name="([^"]+)"/g)) {
    if (!names.includes(m[1])) fail(`unknown icon reference: ${m[1]}`);
  }
}

if (errors.length > 0) {
  console.error(`check-icons: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`check-icons: ${names.length} icons OK`);
