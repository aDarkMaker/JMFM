import {createUserStorage, readVersioned, writeVersioned} from '@/data/user-storage';
import {STORAGE_KEYS, STORAGE_VERSION} from '@/data/storage-keys';
import {
  APK_ASSET_NAME,
  RAW_MANIFEST_URL,
  RELEASES_API,
  UPDATE_CONFIG,
  VERSION_ASSET_NAME,
  assetMirrorUrls,
} from './constants';
import {UpdateHttpError, updateFetchTextResult} from './http';
import {parseManifest, type VersionManifest} from './manifest';

export type UpdateSource = 'api' | 'raw' | 'cache';

export interface ReleaseInfo {
  manifest: VersionManifest;
  /** Release tag the manifest and APK belong to. */
  tag: string;
  source: UpdateSource;
  /** True when the payload came from cache after every remote source failed. */
  stale: boolean;
}

interface CachedRelease {
  tag: string;
  manifest: VersionManifest;
  etag?: string;
  fetchedAt: number;
}

const API_TTL_MS = UPDATE_CONFIG.apiTtlMs;

const storage = createUserStorage();
let memoryCache: CachedRelease | null = null;

function sanitizeReleaseNotes(body: string | undefined): string {
  if (!body) return '';
  // Strip any HTML to keep notes plain-text in dialogs.
  return body
    .replace(/<[^>]*>/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function coerceCache(legacy: unknown): CachedRelease {
  const data = (legacy && typeof legacy === 'object' ? legacy : {}) as Partial<CachedRelease>;
  const fetchedAt = Number(data.fetchedAt);
  return {
    tag: typeof data.tag === 'string' && data.tag ? data.tag : 'latest',
    manifest: parseManifest(data.manifest),
    ...(typeof data.etag === 'string' ? {etag: data.etag} : {}),
    fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : 0,
  };
}

async function readCache(): Promise<CachedRelease | null> {
  if (memoryCache) {
    return memoryCache;
  }
  try {
    const stored = await readVersioned<unknown>(
      storage,
      STORAGE_KEYS.updateRelease,
      STORAGE_VERSION,
      coerceCache
    );
    if (!stored) {
      return null;
    }
    memoryCache = coerceCache(stored.data);
    return memoryCache;
  } catch {
    return null;
  }
}

async function writeCache(entry: CachedRelease): Promise<void> {
  memoryCache = entry;
  try {
    await writeVersioned(storage, STORAGE_KEYS.updateRelease, STORAGE_VERSION, entry);
  } catch {
    // A failed cache write must never block an available update.
  }
}

function isFresh(entry: CachedRelease): boolean {
  return Date.now() - entry.fetchedAt <= API_TTL_MS;
}

async function fetchManifestFromTag(tag: string): Promise<VersionManifest> {
  let lastError: unknown;
  for (const url of assetMirrorUrls(tag, VERSION_ASSET_NAME)) {
    try {
      const {text} = await updateFetchTextResult(url);
      return parseManifest(JSON.parse(text) as unknown);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('version.json unavailable');
}

interface GitHubRelease {
  tag_name?: string;
  body?: string;
}

async function fromApi(cached: CachedRelease | null): Promise<ReleaseInfo> {
  const headers: Record<string, string> = {Accept: 'application/vnd.github+json'};
  if (cached?.etag) {
    headers['If-None-Match'] = cached.etag;
  }

  let etag: string | undefined;
  let release: GitHubRelease;
  try {
    const res = await updateFetchTextResult(RELEASES_API, {headers});
    etag = res.etag;
    release = JSON.parse(res.text) as GitHubRelease;
  } catch (e) {
    if (e instanceof UpdateHttpError && e.status === 304 && cached && isFresh(cached)) {
      return {manifest: cached.manifest, tag: cached.tag, source: 'api', stale: false};
    }
    throw e;
  }

  const tag = release.tag_name || 'latest';
  const manifest = await fetchManifestFromTag(tag);
  const notes = sanitizeReleaseNotes(release.body);
  if (notes && !manifest.notes) {
    manifest.notes = notes;
  }
  const entry: CachedRelease = {
    tag,
    manifest,
    fetchedAt: Date.now(),
    ...(etag ? {etag} : {}),
  };
  await writeCache(entry);
  return {manifest, tag, source: 'api', stale: false};
}

async function fromRaw(): Promise<ReleaseInfo> {
  const {text} = await updateFetchTextResult(RAW_MANIFEST_URL, {
    headers: {Accept: 'application/json'},
  });
  const manifest = parseManifest(JSON.parse(text) as unknown);
  const tag = 'latest';
  await writeCache({tag, manifest, fetchedAt: Date.now()});
  return {manifest, tag, source: 'raw', stale: false};
}

async function fromCache(): Promise<ReleaseInfo> {
  const cached = await readCache();
  if (!cached) {
    throw new Error('no cached release');
  }
  return {
    manifest: cached.manifest,
    tag: cached.tag,
    source: 'cache',
    stale: !isFresh(cached),
  };
}

/**
 * Resolves the newest release in order: GitHub API → raw `version.json` → local cache.
 * Rate limits (403/429) and missing assets fall through to the next source.
 */
export async function fetchLatestRelease(): Promise<ReleaseInfo> {
  const cached = await readCache();
  let lastError: unknown;
  for (const load of [() => fromApi(cached), fromRaw]) {
    try {
      return await load();
    } catch (e) {
      lastError = e;
    }
  }
  try {
    return await fromCache();
  } catch {
    throw lastError instanceof Error ? lastError : new Error('update source unavailable');
  }
}

/** Builds the ordered APK mirror list for a resolved release tag. */
export function buildApkCandidates(tag: string): string[] {
  return assetMirrorUrls(tag, APK_ASSET_NAME);
}
