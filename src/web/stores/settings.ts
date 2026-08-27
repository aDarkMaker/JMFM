import {create} from 'zustand';
import {
  createSettingsStorage,
  DEFAULT_SETTINGS,
  sanitizeSettings,
  Settings,
} from '../../data/settings';
import {clearCoverCache} from '../library/coverCache';
import {clearImageDocCache} from '../reader/image-doc';

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load(): Promise<void>;
  update(patch: Partial<Settings>): Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  async load() {
    const storage = createSettingsStorage();
    const settings = await storage.load();
    set({settings, loaded: true});
  },
  async update(patch) {
    const prev = get().settings;
    const settings = sanitizeSettings({...prev, ...patch});
    const pathChanged =
      settings.downloadPath !== prev.downloadPath ||
      settings.downloadTreeUri !== prev.downloadTreeUri;
    if (pathChanged) {
      clearCoverCache();
      clearImageDocCache();
    }
    set({settings});
    const storage = createSettingsStorage();
    await storage.save(settings);
  },
}));

/** Await settings load so consumers never filter against default values. */
export function waitForSettingsLoaded(): Promise<void> {
  return new Promise((resolve) => {
    if (useSettingsStore.getState().loaded) {
      resolve();
      return;
    }
    const unsubscribe = useSettingsStore.subscribe((state) => {
      if (state.loaded) {
        unsubscribe();
        resolve();
      }
    });
  });
}
