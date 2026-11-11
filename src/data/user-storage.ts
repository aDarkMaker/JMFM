import {Capacitor} from '@capacitor/core';
import {Preferences} from '@capacitor/preferences';

export interface UserStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
}

class NativeUserStorage implements UserStorage {
  async get(key: string): Promise<string | null> {
    const {value} = await Preferences.get({key});
    return value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await Preferences.set({key, value});
  }

  async remove(key: string): Promise<void> {
    await Preferences.remove({key});
  }

  async keys(prefix?: string): Promise<string[]> {
    const {keys} = await Preferences.keys();
    return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
  }
}

class WebUserStorage implements UserStorage {
  async get(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  async set(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(key);
  }

  async keys(prefix?: string): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (!prefix || k.startsWith(prefix))) {
        keys.push(k);
      }
    }
    return keys;
  }
}

export function createUserStorage(): UserStorage {
  return Capacitor.isNativePlatform() ? new NativeUserStorage() : new WebUserStorage();
}

/**
 * On native, migrates legacy localStorage data into Preferences; no-op on web.
 */
export async function migrateFromLocalStorage(
  storage: UserStorage,
  key: string
): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) {
    return storage.get(key);
  }
  const current = await storage.get(key);
  if (current != null) {
    return current;
  }
  try {
    const legacy = localStorage.getItem(key);
    if (legacy != null) {
      await storage.set(key, legacy);
      return legacy;
    }
  } catch {
    // ignore
  }
  return null;
}

/** Versioned envelope written by `writeVersioned`. */
export interface VersionedPayload<T> {
  v: number;
  data: T;
}

export interface ReadVersionedResult<T> {
  data: T;
  /** Version found on disk; equal to `target` for freshly written payloads. */
  version: number;
  /** True when the payload was migrated from an older envelope. */
  migrated: boolean;
}

function isVersioned(raw: unknown): raw is VersionedPayload<unknown> {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    !Array.isArray(raw) &&
    typeof (raw as {v?: unknown}).v === 'number' &&
    'data' in (raw as Record<string, unknown>)
  );
}

/**
 * Reads a `{v, data}` envelope. Legacy payloads (no envelope) are passed to
 * `migrate` so old installs keep their data; unreadable payloads yield `null`.
 */
export async function readVersioned<T>(
  storage: UserStorage,
  key: string,
  target: number,
  migrate?: (legacy: unknown, fromVersion: number) => T
): Promise<ReadVersionedResult<T> | null> {
  const raw = await storage.get(key);
  if (raw == null || raw === '') {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (isVersioned(parsed)) {
    const version = parsed.v;
    try {
      const data =
        version === target || !migrate ? (parsed.data as T) : migrate(parsed.data, version);
      return {data, version, migrated: version !== target};
    } catch {
      return null;
    }
  }

  try {
    const data = migrate ? migrate(parsed, 0) : (parsed as T);
    return {data, version: 0, migrated: true};
  } catch {
    return null;
  }
}

export async function writeVersioned<T>(
  storage: UserStorage,
  key: string,
  target: number,
  data: T
): Promise<void> {
  const payload: VersionedPayload<T> = {v: target, data};
  await storage.set(key, JSON.stringify(payload));
}

