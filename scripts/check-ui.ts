/**
 * UI kit gate.
 *
 *  - Every `src/web/ui/<Name>/` must ship `index.tsx` and exactly one `*.module.css`.
 *  - `src/web/ui/index.ts` must re-export every UI directory.
 *  - Global CSS (`styles/*.css`) may only keep contract classes JS reaches by name.
 *  - Legacy bare class names from the pre-module era must not return to global CSS.
 *
 * Component-local selectors inside `*.module.css` are scoped by the bundler and are
 * therefore exempt from the class-name allowlist.
 *
 * Run with: bun scripts/check-ui.ts
 */
import {readdirSync, readFileSync, existsSync} from 'node:fs';
import {join, relative} from 'node:path';

const ROOT = join(import.meta.dir, '..');
const UI_DIR = join(ROOT, 'src/web/ui');
const UI_INDEX = join(UI_DIR, 'index.ts');
const STYLES_DIR = join(ROOT, 'src/web/styles');

/** Global classes addressable from JS (classList / template strings) or the shell. */
const CONTRACT_CLASSES = new Set([
  'app',
  'app-content',
  'app-screen',
  'app-tabbar',
  'app-empty',
  'app-empty--fixed',
  'sticky-chrome',
  'tab-pane',
  'tab-pane-inner',
  'tab-item',
  'tab-icon',
  'tab-label',
  'nav-layer',
  'nav-screen',
  'nav-scroll',
  'nav-open',
  'is-covered',
  'is-active',
  'is-closing',
  'is-search',
  'is-switching',
  'chrome-hidden',
  'is-pulling',
  'is-search-locked',
  'keyboard-open',
]);

const BANNED_GLOBAL_SELECTORS = [
  'chip',
  'chip-row',
  'nav-btn',
  'nav-bar',
  'nav-title',
  'confirm-btn',
  'theme-segmented',
  'toggle-track',
  'toggle-thumb',
  'task-badge',
  'task-tile',
  'download-button',
  'empty-state',
  'list-tile',
  'progress-bar',
  'search-bar',
  'section-header',
  'skeleton',
  'toast',
];

const errors: string[] = [];
const fail = (message: string) => errors.push(message);

const dirs = existsSync(UI_DIR)
  ? readdirSync(UI_DIR, {withFileTypes: true})
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  : [];

if (dirs.length === 0) {
  fail('src/web/ui has no component directories');
}

const indexSource = existsSync(UI_INDEX) ? readFileSync(UI_INDEX, 'utf-8') : '';
if (!indexSource) {
  fail('missing src/web/ui/index.ts');
}

for (const name of dirs) {
  const dir = join(UI_DIR, name);
  const files = readdirSync(dir);
  if (!files.includes('index.tsx')) {
    fail(`ui/${name}: missing index.tsx`);
  }
  const modules = files.filter((file) => file.endsWith('.module.css'));
  if (modules.length !== 1) {
    fail(`ui/${name}: expected exactly one *.module.css (found ${modules.length})`);
  }
  if (!indexSource.includes(`'@/web/ui/${name}'`)) {
    fail(`ui/${name}: not re-exported from ui/index.ts`);
  }
}

for (const match of indexSource.matchAll(/'@\/web\/ui\/([A-Za-z0-9]+)'/g)) {
  if (!dirs.includes(match[1])) {
    fail(`ui/index.ts exports missing directory ui/${match[1]}`);
  }
}

const globalCss = existsSync(STYLES_DIR)
  ? readdirSync(STYLES_DIR)
      .filter((file) => file.endsWith('.css'))
      .map((file) => join(STYLES_DIR, file))
  : [];

for (const file of globalCss) {
  const text = readFileSync(file, 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/url\([^)]*\)/g, '')
    .replace(/format\([^)]*\)/g, '');
  const name = relative(ROOT, file);
  for (const match of text.matchAll(/\.([a-zA-Z][\w-]*)/g)) {
    if (!CONTRACT_CLASSES.has(match[1])) {
      fail(`${name}: non-contract class .${match[1]} — move it into *.module.css`);
    }
  }
  for (const banned of BANNED_GLOBAL_SELECTORS) {
    if (new RegExp(`\\.${banned}(?![\\w-])`).test(text)) {
      fail(`${name}: legacy selector .${banned}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`check-ui: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`check-ui: ${dirs.length} components OK`);
