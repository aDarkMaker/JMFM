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
  const next: AppVersion =
    kind === 'minor'
      ? {
          version: `${major}.${minor + 1}.0`,
          versionCode: toVersionCode(major, minor + 1, 0),
        }
      : {
          version: `${major + 1}.0.0`,
          versionCode: toVersionCode(major + 1, 0, 0),
        };
  // A minimum below the new build would otherwise force every installed client.
  if (current.minVersionCode != null && current.minVersionCode < next.versionCode) {
    next.minVersionCode = current.minVersionCode;
  }
  return next;
}

function writeVersion(next: AppVersion): void {
  writeFileSync(VERSION_FILE, `${JSON.stringify(next, null, 2)}\n`);
  const pkg = JSON.parse(readFileSync(PKG_FILE, 'utf8')) as {version: string};
  pkg.version = next.version;
  writeFileSync(PKG_FILE, `${JSON.stringify(pkg, null, 2)}\n`);
}

function parseMinVersionCode(raw: string | undefined): number | undefined {
  if (raw == null || raw === '') {
    return undefined;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`invalid minVersionCode: ${raw}`);
  }
  return Math.trunc(n);
}

if (import.meta.main) {
  const kind = process.argv[2];
  if (kind !== 'minor' && kind !== 'major') {
    console.error(
      'Usage: bun scripts/bump-version.ts minor|major [--min-version-code N]\n' +
        '  --min-version-code N  force-update every build below N (omitted = unchanged)'
    );
    process.exit(1);
  }

  const flagIndex = process.argv.indexOf('--min-version-code');
  const explicitMin =
    flagIndex >= 0 ? parseMinVersionCode(process.argv[flagIndex + 1]) : undefined;

  const next = bumpVersion(kind, readVersion());
  if (explicitMin !== undefined) {
    if (explicitMin > next.versionCode) {
      throw new Error(
        `minVersionCode ${explicitMin} cannot exceed the new versionCode ${next.versionCode}`
      );
    }
    next.minVersionCode = explicitMin;
  }
  writeVersion(next);
  console.log(`bumped to ${next.version} (versionCode ${next.versionCode})`);
}
