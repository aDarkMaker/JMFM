import {create} from 'zustand';
import {
  createSettingsStorage,
  DEFAULT_SETTINGS,
  sanitizeSettings,
  Settings,
} from '../../data/settings';

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
    const settings = sanitizeSettings({...get().settings, ...patch});
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
