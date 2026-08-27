import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {readVersion, type AppVersion} from './read-version';

const ROOT = join(import.meta.dir, '..');
const PKG_FILE = join(ROOT, 'package.json');
const VERSION_FILE = join(ROOT, 'version.json');

function parseSemver(version: string): {major: number; minor: number; patch: number} {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!m) {
    throw new Error(`invalid semver: ${version}`);
  }
  return {major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3])};
}

export function toVersionCode(major: number, minor: number, patch: number): number {
  return major * 10000 + minor * 100 + patch;
}

export function bumpVersion(kind: 'minor' | 'major', current: AppVersion): AppVersion {
  const {major, minor} = parseSemver(current.version);
  if (kind === 'minor') {
    return {
      version: `${major}.${minor + 1}.0`,
      versionCode: toVersionCode(major, minor + 1, 0),
    };
  }
  return {
    version: `${major + 1}.0.0`,
    versionCode: toVersionCode(major + 1, 0, 0),
  };
}

function writeVersion(next: AppVersion): void {
  writeFileSync(VERSION_FILE, `${JSON.stringify(next, null, 2)}\n`);
  const pkg = JSON.parse(readFileSync(PKG_FILE, 'utf8')) as {version: string};
  pkg.version = next.version;
  writeFileSync(PKG_FILE, `${JSON.stringify(pkg, null, 2)}\n`);
}

const kind = process.argv[2];
if (kind !== 'minor' && kind !== 'major') {
  console.error('Usage: bun scripts/bump-version.ts minor|major');
  process.exit(1);
}

const next = bumpVersion(kind, readVersion());
writeVersion(next);
console.log(`bumped to ${next.version} (versionCode ${next.versionCode})`);
