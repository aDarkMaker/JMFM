/**
 * Debug-code gate.
 *
 * Release builds must not keep stray logging or blocking dialogs. `console.warn`
 * and `console.error` stay allowed; the dev overlay and scripts are exempt.
 *
 * Run with: bun scripts/check-debug-code.ts
 */
import {readdirSync, readFileSync, existsSync} from 'node:fs';
import {join, relative} from 'node:path';

const ROOT = join(import.meta.dir, '..');
const SCAN_DIRS = ['src', 'scripts'];
const EXEMPT = [/^src\/web\/dev\//, /^scripts\//, /^__tests__\//];

const errors: string[] = [];

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'generated') continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const name = relative(ROOT, file);
    if (EXEMPT.some((re) => re.test(name))) continue;
    const source = readFileSync(file, 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    source.split('\n').forEach((line, index) => {
      if (/(^|[^.\w])console\.(log|debug|info|trace|dir|table)\s*\(/.test(line)) {
        errors.push(`${name}:${index + 1} console.* must not ship (use warn/error or delete)`);
      }
      if (/\bdebugger\s*;?/.test(line)) {
        errors.push(`${name}:${index + 1} debugger statement`);
      }
      if (/(^|[^.\w])(window\.)?alert\s*\(/.test(line)) {
        errors.push(`${name}:${index + 1} alert() — use ui/Toast or ui/Dialog`);
      }
    });
  }
}

if (errors.length > 0) {
  console.error(`check-debug-code: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log('check-debug-code: OK');
