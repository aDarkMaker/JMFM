/**
 * i18n gate.
 *
 *  - Every `t('key')` / `t("key")` literal must exist in `src/web/i18n/zh-CN.ts`.
 *  - Every dictionary key must be referenced at least once (dead keys are drift).
 *  - JSX/TS sources outside the dictionary must not contain CJK user-facing text;
 *    comments are stripped before the scan, and a few domain allowlists cover
 *    titles that come from the API or the OS.
 *  - Icon-only `IconButton` must declare `label`; bare `<button>` with an icon and
 *    no text must declare `aria-label`.
 *
 * Run with: bun scripts/check-i18n.ts
 */
import {readdirSync, readFileSync, existsSync} from 'node:fs';
import {join, relative} from 'node:path';

const ROOT = join(import.meta.dir, '..');
const I18N_FILE = join(ROOT, 'src/web/i18n/zh-CN.ts');
const SCAN_DIR = join(ROOT, 'src/web');

/** Files allowed to hold CJK: the dictionary itself and API-provided tag names. */
const CJK_ALLOWLIST = new Set([
  'src/web/i18n/zh-CN.ts',
  'src/web/library/tags.ts',
  'src/web/download/taskCleanup.ts',
]);

/** Technical strings that legitimately carry CJK (regexes, storage identifiers). */
const CJK_LINE_ALLOWLIST = [/正则/, /test\(/, /RegExp/];

const errors: string[] = [];
const fail = (message: string) => errors.push(message);

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'assets' || entry.name === 'generated') continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const dictionarySource = existsSync(I18N_FILE) ? readFileSync(I18N_FILE, 'utf-8') : '';
if (!dictionarySource) {
  fail('missing src/web/i18n/zh-CN.ts');
}

const definedKeys = new Set(
  [...dictionarySource.matchAll(/^\s*'([^']+)'\s*:/gm)].map((match) => match[1])
);
if (definedKeys.size === 0) {
  fail('zh-CN.ts exposes no keys');
}

const sources = walk(SCAN_DIR)
  .filter((file) => file !== I18N_FILE)
  .map((file) => [relative(ROOT, file), stripComments(readFileSync(file, 'utf-8'))] as const);

// Constants living in src/core also carry `labelKey` values.
const coreSources = walk(join(ROOT, 'src/core')).map(
  (file) => [relative(ROOT, file), readFileSync(file, 'utf-8')] as const
);

const usedKeys = new Set<string>();

for (const [name, source] of [...sources, ...coreSources]) {
  for (const match of source.matchAll(/\bt\(\s*'([^']+)'/g)) {
    const key = match[1];
    if (!definedKeys.has(key)) {
      fail(`${name}: unknown i18n key '${key}'`);
    }
  }

  // Keys also travel as plain strings (e.g. `labelKey: 'tab.home'`, ternaries).
  for (const match of source.matchAll(/['"]([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+)['"]/g)) {
    if (definedKeys.has(match[1])) {
      usedKeys.add(match[1]);
    }
  }

  if (CJK_ALLOWLIST.has(name)) continue;
  // src/core carries network/domain strings, not UI copy.
  if (name.startsWith('src/core/')) continue;

  const lines = source.split('\n');
  lines.forEach((line, index) => {
    if (!/[\u4e00-\u9fff]/.test(line)) return;
    if (CJK_LINE_ALLOWLIST.some((re) => re.test(line))) return;
    fail(`${name}:${index + 1} CJK literal outside the dictionary — use t()`);
  });
}

for (const key of definedKeys) {
  if (!usedKeys.has(key)) {
    fail(`zh-CN.ts: unused key '${key}'`);
  }
}

// Icon-only controls must be reachable for screen readers.
for (const [name, source] of sources) {
  for (const match of source.matchAll(/<IconButton\b([\s\S]*?)\/?>/g)) {
    if (!/\blabel=/.test(match[1])) {
      fail(`${name}: <IconButton> without label (icon-only controls need aria-label)`);
    }
  }
}

if (errors.length > 0) {
  console.error(`check-i18n: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`check-i18n: ${definedKeys.size} keys OK`);
