export const GITHUB_OWNER = 'aDarkMaker';
export const GITHUB_REPO = 'JMFM';
export const APK_ASSET_NAME = 'JMFM.apk';
export const VERSION_ASSET_NAME = 'version.json';

export const RELEASES_API =
  `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

// Assets are pinned to a concrete release tag (never the `latest` wildcard)
// so version.json and its APK always belong to the same release.
export function releaseAssetUrl(tag: string, asset: string): string {
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${tag}/${asset}`;
}

export const UPDATE_TIMEOUT = {
  CONNECT_MS: 15_000,
  READ_VERSION_MS: 60_000,
  READ_APK_MS: 180_000,
  RETRY_ATTEMPTS: 3,
  RETRY_INTERVAL_MS: 1_000,
} as const;
