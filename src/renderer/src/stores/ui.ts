import { create } from 'zustand';

export type Page = 'library' | 'downloads' | 'settings';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
  action?: ToastAction;
  durationMs: number;
}

export interface ToastInput {
  message: string;
  tone?: Toast['tone'];
  action?: ToastAction;
  durationMs?: number;
}

interface UiState {
  page: Page;
  addUrl: string | null;
  videoItemId: string | null;
  toasts: Toast[];
  skipSetup: boolean;
  setPage: (page: Page) => void;
  openAdd: (url: string) => void;
  closeAdd: () => void;
  openVideo: (itemId: string) => void;
  closeVideo: () => void;
  pushToast: (toast: ToastInput) => number;
  dismissToast: (id: number) => void;
  setSkipSetup: (skip: boolean) => void;
}

let nextToastId = 1;

export const useUi = create<UiState>()((set) => ({
  page: 'library',
  addUrl: null,
  videoItemId: null,
  toasts: [],
  skipSetup: false,
  setPage: (page) => set({ page }),
  openAdd: (url) => set({ addUrl: url }),
  closeAdd: () => set({ addUrl: null }),
  openVideo: (itemId) => set({ videoItemId: itemId }),
  closeVideo: () => set({ videoItemId: null }),
  pushToast: ({ message, tone = 'info', action, durationMs = 5000 }) => {
    const id = nextToastId++;
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id, message, tone, action, durationMs }] }));
    return id;
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  setSkipSetup: (skipSetup) => set({ skipSetup }),
}));
