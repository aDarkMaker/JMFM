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
    return prefix ? keys.filter(k => k.startsWith(prefix)) : keys;
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
  key: string,
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
