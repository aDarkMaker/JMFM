export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

export function parseSemver(version: string): SemVer | null {
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(version.trim());
  if (!m) {
    return null;
  }
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3] ?? 0),
  };
}

export function normalizeSemver(version: string): string {
  const parsed = parseSemver(version);
  if (!parsed) {
    return version;
  }
  return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
}

/** Returns -1 if a < b, 0 if equal, 1 if a > b */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) {
    throw new Error(`invalid semver: ${!pa ? a : b}`);
  }
  if (pa.major !== pb.major) {
    return pa.major < pb.major ? -1 : 1;
  }
  if (pa.minor !== pb.minor) {
    return pa.minor < pb.minor ? -1 : 1;
  }
  if (pa.patch !== pb.patch) {
    return pa.patch < pb.patch ? -1 : 1;
  }
  return 0;
}

export function isNewerVersion(current: string, latest: string): boolean {
  return compareSemver(current, latest) < 0;
}
