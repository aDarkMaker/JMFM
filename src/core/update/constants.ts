export const GITHUB_OWNER = 'aDarkMaker';
export const GITHUB_REPO = 'JMFM';
export const APK_ASSET_NAME = 'JMFM.apk';
export const VERSION_ASSET_NAME = 'version.json';

const RELEASE_BASE =
  `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/latest`;

export const VERSION_JSON_URL = `${RELEASE_BASE}/${VERSION_ASSET_NAME}`;
export const APK_DOWNLOAD_URL = `${RELEASE_BASE}/${APK_ASSET_NAME}`;

export const RELEASES_API =
  `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

export const UPDATE_TIMEOUT = {
  CONNECT_MS: 15_000,
  READ_VERSION_MS: 60_000,
  READ_APK_MS: 180_000,
  RETRY_ATTEMPTS: 3,
  RETRY_INTERVAL_MS: 1_000,
} as const;
