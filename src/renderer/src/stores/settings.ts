import { create } from 'zustand';
import type { SettingsPatch } from '@shared/ipc-contract';
import type { Settings } from '@shared/types';

interface SettingsState {
  settings: Settings | null;
  load: () => Promise<void>;
  update: (patch: SettingsPatch) => Promise<Settings>;
  apply: (settings: Settings) => void;
}

export const useSettings = create<SettingsState>()((set) => ({
  settings: null,
  load: async () => set({ settings: await window.downtube.settings.get() }),
  update: async (patch) => {
    const next = await window.downtube.settings.update(patch);
    set({ settings: next });
    return next;
  },
  apply: (settings) => set({ settings }),
}));
