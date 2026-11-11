import {isNewerVersion, parseSemver} from './semver';

/** Expanded `version.json` contract shared by the app and the release workflow. */
export interface VersionManifest {
  version: string;
  versionCode: number;
  /** Installs below this code must update before continuing. */
  minVersionCode?: number;
  apkSha256?: string;
  apkSize?: number;
  notes?: string;
}

export interface LocalVersion {
  version: string;
  versionCode?: number;
}

export type UpdateDecision =
  | {kind: 'none'}
  | {kind: 'optional'; manifest: VersionManifest}
  | {kind: 'force'; manifest: VersionManifest};

function toFiniteCode(value: unknown): number | undefined {
  const code = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(code) && code > 0 ? Math.trunc(code) : undefined;
}

export function parseManifest(raw: unknown): VersionManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error('invalid version manifest');
  }
  const data = raw as Record<string, unknown>;
  const version = typeof data.version === 'string' ? data.version.trim() : '';
  const versionCode = toFiniteCode(data.versionCode);
  if (!version || !parseSemver(version) || versionCode === undefined) {
    throw new Error('invalid version manifest');
  }
  const manifest: VersionManifest = {version, versionCode};
  const minVersionCode = toFiniteCode(data.minVersionCode);
  if (minVersionCode !== undefined) {
    manifest.minVersionCode = minVersionCode;
  }
  if (typeof data.apkSha256 === 'string' && data.apkSha256.length === 64) {
    manifest.apkSha256 = data.apkSha256.toLowerCase();
  }
  const apkSize = toFiniteCode(data.apkSize);
  if (apkSize !== undefined) {
    manifest.apkSize = apkSize;
  }
  if (typeof data.notes === 'string' && data.notes.trim()) {
    manifest.notes = data.notes.trim();
  }
  return manifest;
}

export function isNewerManifest(local: LocalVersion, remote: VersionManifest): boolean {
  if (local.versionCode != null) {
    return remote.versionCode > local.versionCode;
  }
  return isNewerVersion(local.version, remote.version);
}

export function decideUpdate(local: LocalVersion, remote: VersionManifest): UpdateDecision {
  const hasUpdate = isNewerManifest(local, remote);
  if (!hasUpdate) {
    return {kind: 'none'};
  }
  const min = remote.minVersionCode ?? 0;
  const code = local.versionCode;
  if (code != null && code < min) {
    return {kind: 'force', manifest: remote};
  }
  return {kind: 'optional', manifest: remote};
}
