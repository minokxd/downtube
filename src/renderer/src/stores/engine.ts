import { create } from 'zustand';
import type { EngineComponentId, EngineInstallProgress, EngineStatus } from '@shared/types';

interface EngineState {
  status: EngineStatus | null;
  installing: boolean;
  installError: string | null;
  progress: Partial<Record<EngineComponentId, EngineInstallProgress>>;
  refresh: () => Promise<void>;
  install: (force?: boolean) => Promise<void>;
  onProgress: (progress: EngineInstallProgress) => void;
}

export const useEngine = create<EngineState>()((set, get) => ({
  status: null,
  installing: false,
  installError: null,
  progress: {},
  refresh: async () => set({ status: await window.downtube.engine.status() }),
  install: async (force = false) => {
    if (get().installing) return;
    set({ installing: true, installError: null, progress: {} });
    try {
      set({ status: await window.downtube.engine.install(force) });
    } catch (err) {
      set({ installError: err instanceof Error ? err.message : String(err) });
      await get().refresh().catch(() => undefined);
    } finally {
      set({ installing: false });
    }
  },
  onProgress: (progress) => set((state) => ({ progress: { ...state.progress, [progress.component]: progress } })),
}));
