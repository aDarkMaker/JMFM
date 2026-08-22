import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Settings {
  downloadPath: string;
  retryTimes: number;
  imageThreads: number;
  imageFormat: string;
  proxy: string;
}

export const DEFAULT_SETTINGS: Settings = {
  downloadPath: 'JMFMobile/downloads',
  retryTimes: 3,
  imageThreads: 0,
  imageFormat: 'webp',
  proxy: '',
};

const KEY = 'jmf.settings';

export function sanitizeSettings(raw: Partial<Settings>): Settings {
  return {
    downloadPath: raw.downloadPath?.trim() || DEFAULT_SETTINGS.downloadPath,
    retryTimes: normalizeInt(raw.retryTimes, 1, 10, DEFAULT_SETTINGS.retryTimes),
    imageThreads: normalizeInt(raw.imageThreads, 0, 64, DEFAULT_SETTINGS.imageThreads),
    imageFormat: raw.imageFormat || DEFAULT_SETTINGS.imageFormat,
    proxy: raw.proxy?.trim() || '',
  };
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

export async function loadSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) {
    return DEFAULT_SETTINGS;
  }
  try {
    return sanitizeSettings(JSON.parse(raw) as Partial<Settings>);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const clean = sanitizeSettings(settings);
  await AsyncStorage.setItem(KEY, JSON.stringify(clean));
}
