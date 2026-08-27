import {readFileSync} from 'node:fs';
import {join} from 'node:path';

export interface AppVersion {
  version: string;
  versionCode: number;
}

const ROOT = join(import.meta.dir, '..');
const VERSION_FILE = join(ROOT, 'version.json');

export function readVersion(): AppVersion {
  const raw = readFileSync(VERSION_FILE, 'utf8');
  const data = JSON.parse(raw) as AppVersion;
  if (!data.version || !Number.isFinite(data.versionCode)) {
    throw new Error('invalid version.json');
  }
  return data;
}

if (import.meta.main) {
  const v = readVersion();
  console.log(JSON.stringify(v));
}
