import {isHardBlockedKeyword} from '../core/model/blocklist';
import {createUserStorage} from './user-storage';
import {STORAGE_KEYS} from './storage-keys';

export interface Settings {
  downloadPath: string;
  /** SAF tree URI for cross-install access to existing downloads on Android. */
  downloadTreeUri?: string;
  retryTimes: number;
  imageThreads: number;
  imageFormat: string;
  proxy: string;
  proxyEnabled: boolean;
  domains: string[];
  blacklistTags: string[];
  whitelistTags: string[];
  theme: 'light' | 'dark';
  readerMode: 'scroll' | 'paged';
}

export const DEFAULT_SETTINGS: Settings = {
  downloadPath: 'JMFMobile/downloads',
  retryTimes: 3,
  imageThreads: 0,
  imageFormat: 'webp',
  proxy: '',
  proxyEnabled: false,
  domains: ['18comic.vip', '18comic.org', 'jmcomic.me', 'jmcomic1.me', 'jmcomic2.me'],
  blacklistTags: [],
  whitelistTags: [],
  theme: 'light',
  readerMode: 'scroll',
};

/** Strip Documents/ prefix for native Capacitor fs (already rooted at Directory.Documents). */
function normalizeDownloadPath(path: string, hasSafUri: boolean): string {
  if (hasSafUri || !path.startsWith('Documents/')) {
    return path;
  }
  return path.slice('Documents/'.length);
}

export function sanitizeSettings(raw: Partial<Settings>): Settings {
  const downloadTreeUri = raw.downloadTreeUri?.trim() || undefined;
  const downloadPath = normalizeDownloadPath(
    raw.downloadPath?.trim() || DEFAULT_SETTINGS.downloadPath,
    Boolean(downloadTreeUri)
  );
  return {
    downloadPath,
    downloadTreeUri,
    retryTimes: normalizeInt(raw.retryTimes, 1, 10, DEFAULT_SETTINGS.retryTimes),
    imageThreads: normalizeInt(raw.imageThreads, 0, 64, DEFAULT_SETTINGS.imageThreads),
    imageFormat: raw.imageFormat || DEFAULT_SETTINGS.imageFormat,
    proxy: raw.proxy?.trim() || '',
    proxyEnabled: raw.proxyEnabled === true,
    domains: sanitizeDomains(raw.domains),
    blacklistTags: sanitizeBlacklist(raw.blacklistTags),
    whitelistTags: sanitizeWhitelist(raw.whitelistTags),
    theme: raw.theme === 'dark' ? 'dark' : 'light',
    readerMode: raw.readerMode === 'paged' ? 'paged' : 'scroll',
  };
}

function sanitizeDomains(raw: string[] | undefined): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...DEFAULT_SETTINGS.domains];
  }
  return raw.map((d) => String(d).trim()).filter(Boolean);
}

function sanitizeBlacklist(raw: string[] | undefined): string[] {
  return sanitizeTagList(raw);
}

function sanitizeWhitelist(raw: string[] | undefined): string[] {
  return sanitizeTagList(raw);
}

function sanitizeTagList(raw: string[] | undefined): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    const tag = String(item).trim();
    if (!tag || isHardBlockedKeyword(tag)) {
      continue;
    }
    if (seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    result.push(tag);
  }
  return result;
}

function normalizeInt(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  const v = Number(value);
  if (!Number.isFinite(v)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(v)));
}

export interface SettingsStorage {
  load(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
}

class PersistentSettingsStorage implements SettingsStorage {
  private storage = createUserStorage();

  async load(): Promise<Settings> {
    const value = await this.storage.get(STORAGE_KEYS.settings);
    return value ? parseSettings(value) : DEFAULT_SETTINGS;
  }

  async save(settings: Settings): Promise<void> {
    await this.storage.set(STORAGE_KEYS.settings, JSON.stringify(sanitizeSettings(settings)));
  }
}

function parseSettings(raw: string): Settings {
  try {
    return sanitizeSettings(JSON.parse(raw) as Partial<Settings>);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function createSettingsStorage(): SettingsStorage {
  return new PersistentSettingsStorage();
}
