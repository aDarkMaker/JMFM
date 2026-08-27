import {Capacitor} from '@capacitor/core';
import {Preferences} from '@capacitor/preferences';
import {isHardBlockedKeyword} from '../core/model/blocklist';

export interface Settings {
  downloadPath: string;
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
  domains: [
    '18comic.vip',
    '18comic.org',
    'jmcomic.me',
    'jmcomic1.me',
    'jmcomic2.me',
  ],
  blacklistTags: [],
  whitelistTags: [],
  theme: 'light',
  readerMode: 'scroll',
};

const KEY = 'jmf.settings';

export function sanitizeSettings(raw: Partial<Settings>): Settings {
  return {
    downloadPath: raw.downloadPath?.trim() || DEFAULT_SETTINGS.downloadPath,
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
  return raw.map(d => String(d).trim()).filter(Boolean);
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
  fallback: number,
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

class NativeSettingsStorage implements SettingsStorage {
  async load(): Promise<Settings> {
    const {value} = await Preferences.get({key: KEY});
    return value ? parseSettings(value) : DEFAULT_SETTINGS;
  }

  async save(settings: Settings): Promise<void> {
    await Preferences.set({key: KEY, value: JSON.stringify(sanitizeSettings(settings))});
  }
}

class WebSettingsStorage implements SettingsStorage {
  async load(): Promise<Settings> {
    const value = localStorage.getItem(KEY);
    return value ? parseSettings(value) : DEFAULT_SETTINGS;
  }

  async save(settings: Settings): Promise<void> {
    localStorage.setItem(KEY, JSON.stringify(sanitizeSettings(settings)));
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
  return Capacitor.isNativePlatform()
    ? new NativeSettingsStorage()
    : new WebSettingsStorage();
}

export async function loadSettings(
  storage: SettingsStorage = createSettingsStorage(),
): Promise<Settings> {
  return storage.load();
}

export async function saveSettings(
  settings: Settings,
  storage: SettingsStorage = createSettingsStorage(),
): Promise<void> {
  await storage.save(settings);
}
