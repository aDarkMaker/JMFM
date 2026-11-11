import {readFileSync} from 'node:fs';
import {join} from 'node:path';

export interface AppVersion {
  version: string;
  versionCode: number;
  /** Builds below this code must update before they can be used. */
  minVersionCode?: number;
  apkSha256?: string;
  apkSize?: number;
  notes?: string;
}

const ROOT = join(import.meta.dir, '..');
const VERSION_FILE = join(ROOT, 'version.json');

function positiveInt(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : undefined;
}

/** Reads `version.json`; optional fields are omitted when malformed. */
export function readVersion(): AppVersion {
  const raw = readFileSync(VERSION_FILE, 'utf8');
  const data = JSON.parse(raw) as Record<string, unknown>;
  const version = typeof data.version === 'string' ? data.version.trim() : '';
  const versionCode = positiveInt(data.versionCode);
  if (!version || versionCode === undefined) {
    throw new Error('invalid version.json');
  }
  const result: AppVersion = {version, versionCode};
  const minVersionCode = positiveInt(data.minVersionCode);
  if (minVersionCode !== undefined) {
    result.minVersionCode = minVersionCode;
  }
  if (typeof data.apkSha256 === 'string' && data.apkSha256.length === 64) {
    result.apkSha256 = data.apkSha256.toLowerCase();
  }
  const apkSize = positiveInt(data.apkSize);
  if (apkSize !== undefined) {
    result.apkSize = apkSize;
  }
  if (typeof data.notes === 'string' && data.notes.trim()) {
    result.notes = data.notes.trim();
  }
  return result;
}

if (import.meta.main) {
  const v = readVersion();
  console.log(JSON.stringify(v));
}
