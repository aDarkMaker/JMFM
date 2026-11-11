import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {readVersion} from './read-version';

const ROOT = join(import.meta.dir, '..');
const PKG_FILE = join(ROOT, 'package.json');
const VERSION_FILE = join(ROOT, 'version.json');

export interface ReleaseCheckResult {
  ok: boolean;
  problems: string[];
}

function toVersionCode(version: string): number | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!m) return null;
  return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
}

/** Verifies package.json, version.json and the derived Android versionCode agree. */
export function checkRelease(): ReleaseCheckResult {
  const problems: string[] = [];
  let version: ReturnType<typeof readVersion>;
  try {
    version = readVersion();
  } catch (e) {
    return {ok: false, problems: [e instanceof Error ? e.message : String(e)]};
  }

  const pkg = JSON.parse(readFileSync(PKG_FILE, 'utf8')) as {version?: string};
  if (pkg.version !== version.version) {
    problems.push(`package.json ${pkg.version} != version.json ${version.version}`);
  }

  const derived = toVersionCode(version.version);
  if (derived === null) {
    problems.push(`version.json version is not semver: ${version.version}`);
  } else if (derived !== version.versionCode) {
    problems.push(`versionCode ${version.versionCode} != derived ${derived}`);
  }

  if (version.minVersionCode != null && version.minVersionCode > version.versionCode) {
    problems.push(`minVersionCode ${version.minVersionCode} > versionCode ${version.versionCode}`);
  }

  if (version.apkSha256 != null && !/^[0-9a-f]{64}$/.test(version.apkSha256)) {
    problems.push('apkSha256 must be 64 lowercase hex chars');
  }

  const raw = JSON.parse(readFileSync(VERSION_FILE, 'utf8')) as Record<string, unknown>;
  const unknown = Object.keys(raw).filter(
    (key) =>
      !['version', 'versionCode', 'minVersionCode', 'apkSha256', 'apkSize', 'notes'].includes(key)
  );
  if (unknown.length > 0) {
    problems.push(`unknown version.json keys: ${unknown.join(', ')}`);
  }

  return {ok: problems.length === 0, problems};
}

if (import.meta.main) {
  const result = checkRelease();
  if (!result.ok) {
    for (const problem of result.problems) {
      console.error(`[release] ${problem}`);
    }
    process.exit(1);
  }
  console.log('[release] version metadata consistent');
}
