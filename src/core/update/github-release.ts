import {
  APK_ASSET_NAME,
  GITHUB_OWNER,
  GITHUB_REPO,
  RELEASES_API,
  VERSION_ASSET_NAME,
} from './constants';

export interface RemoteVersion {
  version: string;
  versionCode: number;
}

export interface LatestReleaseInfo {
  version: RemoteVersion;
  apkDownloadUrl: string;
  releaseNotes: string;
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  body?: string;
  assets?: GitHubAsset[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, {
    headers: {Accept: 'application/vnd.github+json'},
  });
  if (!resp.ok) {
    throw new Error(`GitHub API ${resp.status}: ${url}`);
  }
  return resp.json() as Promise<T>;
}

function parseVersionFromReleaseBody(body: string): RemoteVersion | null {
  const m = /Version:\s*`([^`]+)`\s*\(versionCode\s*(\d+)\)/i.exec(body);
  if (!m) {
    return null;
  }
  const version = m[1].trim();
  const versionCode = Number(m[2]);
  if (!version || !Number.isFinite(versionCode)) {
    return null;
  }
  return {version, versionCode};
}

async function resolveRemoteVersion(
  release: GitHubRelease,
  assets: GitHubAsset[],
): Promise<RemoteVersion> {
  const versionAsset = assets.find(a => a.name === VERSION_ASSET_NAME);
  if (versionAsset?.browser_download_url) {
    const remote = await fetchJson<RemoteVersion>(versionAsset.browser_download_url);
    if (remote.version && Number.isFinite(remote.versionCode)) {
      return remote;
    }
  }

  const directUrl =
    `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/latest/${VERSION_ASSET_NAME}`;
  try {
    const remote = await fetchJson<RemoteVersion>(directUrl);
    if (remote.version && Number.isFinite(remote.versionCode)) {
      return remote;
    }
  } catch {
    // fall through to release notes
  }

  const parsed = parseVersionFromReleaseBody(release.body ?? '');
  if (parsed) {
    return parsed;
  }

  throw new Error('release missing version.json asset');
}

export async function fetchLatestRelease(): Promise<LatestReleaseInfo> {
  const release = await fetchJson<GitHubRelease>(RELEASES_API);
  const assets = release.assets ?? [];
  const apkAsset = assets.find(a => a.name === APK_ASSET_NAME);
  if (!apkAsset?.browser_download_url) {
    throw new Error('release missing JMFM.apk asset');
  }

  const remote = await resolveRemoteVersion(release, assets);

  return {
    version: remote,
    apkDownloadUrl: apkAsset.browser_download_url,
    releaseNotes: release.body?.trim() ?? '',
  };
}
