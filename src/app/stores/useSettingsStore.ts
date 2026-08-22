import {create} from 'zustand';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  Settings,
} from '../../data/settings';

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    const settings = await loadSettings();
    set({settings, loaded: true});
  },
  update: async patch => {
    const next = {...get().settings, ...patch};
    await saveSettings(next);
    set({settings: next});
  },
}));
