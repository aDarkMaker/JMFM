import {
  APK_DOWNLOAD_URL,
  RELEASES_API,
  VERSION_JSON_URL,
} from './constants';
import {updateFetchJson} from './http';

export interface RemoteVersion {
  version: string;
  versionCode: number;
}

export interface LatestReleaseInfo {
  version: RemoteVersion;
  apkDownloadUrl: string;
  releaseNotes: string;
}

export async function fetchLatestRelease(): Promise<LatestReleaseInfo> {
  const remote = await updateFetchJson<RemoteVersion>(VERSION_JSON_URL);
  if (!remote.version || !Number.isFinite(remote.versionCode)) {
    throw new Error('invalid remote version.json');
  }

  let releaseNotes = '';
  try {
    const release = await updateFetchJson<{body?: string}>(RELEASES_API, {
      Accept: 'application/vnd.github+json',
    });
    releaseNotes = release.body?.trim() ?? '';
  } catch {
    // release notes are optional; version.json is the source of truth
  }

  return {
    version: remote,
    apkDownloadUrl: APK_DOWNLOAD_URL,
    releaseNotes,
  };
}
