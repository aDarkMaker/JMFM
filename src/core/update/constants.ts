import {config} from '@/config';

export const UPDATE_CONFIG = config.update;
export const GITHUB_OWNER = config.update.owner;
export const GITHUB_REPO = config.update.repo;
export const APK_ASSET_NAME = 'JMFM.apk';
export const VERSION_ASSET_NAME = 'version.json';

export const RELEASES_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
export const RAW_MANIFEST_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${config.update.manifestPath}`;

export const FALLBACK_ASSET_MIRROR =
  'https://github.com/{owner}/{repo}/releases/download/{tag}/{asset}';

// Assets are pinned to a concrete release tag (never the `latest` wildcard)
// so version.json and its APK always belong to the same release.
export function assetMirrorUrls(
  tag: string,
  asset: string,
  patterns: string[] = UPDATE_CONFIG.assetMirrors
): string[] {
  const list = patterns.length ? patterns : [FALLBACK_ASSET_MIRROR];
  return list.map((pattern) =>
    pattern
      .replaceAll('{owner}', GITHUB_OWNER)
      .replaceAll('{repo}', GITHUB_REPO)
      .replaceAll('{tag}', tag)
      .replaceAll('{asset}', asset)
  );
}

export function releaseAssetUrl(tag: string, asset: string): string {
  return assetMirrorUrls(tag, asset)[0]!;
}

export const UPDATE_TIMEOUT = {
  CONNECT_MS: 15_000,
  READ_VERSION_MS: 60_000,
  READ_APK_MS: 180_000,
  RETRY_ATTEMPTS: 3,
  RETRY_INTERVAL_MS: 1_000,
} as const;
