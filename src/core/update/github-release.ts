import {APK_ASSET_NAME, RELEASES_API, VERSION_ASSET_NAME, releaseAssetUrl} from './constants';
import {updateFetchJson} from './http';

export interface RemoteVersion {
  version: string;
  versionCode: number;
  apkSha256?: string;
}

export interface LatestReleaseInfo {
  version: RemoteVersion;
  apkDownloadUrl: string;
  releaseNotes: string;
}

interface GitHubRelease {
  tag_name?: string;
  body?: string;
}

function sanitizeReleaseNotes(body: string | undefined): string {
  if (!body) return '';
  // Strip any HTML to keep notes plain-text in dialogs.
  return body
    .replace(/<[^>]*>/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

export async function fetchLatestRelease(): Promise<LatestReleaseInfo> {
  const release = await updateFetchJson<GitHubRelease>(RELEASES_API, {
    Accept: 'application/vnd.github+json',
  });
  const tag = release.tag_name || 'latest';

  // version.json and the APK are read from the same pinned tag.
  const remote = await updateFetchJson<RemoteVersion>(releaseAssetUrl(tag, VERSION_ASSET_NAME));
  if (!remote.version || !Number.isFinite(remote.versionCode)) {
    throw new Error('invalid remote version.json');
  }

  return {
    version: remote,
    apkDownloadUrl: releaseAssetUrl(tag, APK_ASSET_NAME),
    releaseNotes: sanitizeReleaseNotes(release.body),
  };
}
