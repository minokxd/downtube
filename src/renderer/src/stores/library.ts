import { create } from 'zustand';
import type { Collection, LibraryItem, LibrarySnapshot } from '@shared/types';

interface LibraryState {
  items: LibraryItem[];
  collections: Collection[];
  loaded: boolean;
  load: () => Promise<void>;
  apply: (snapshot: LibrarySnapshot) => void;
}

export const useLibrary = create<LibraryState>()((set) => ({
  items: [],
  collections: [],
  loaded: false,
  load: async () => {
    const snapshot = await window.downtube.library.list();
    set({ items: snapshot.items, collections: snapshot.collections, loaded: true });
  },
  apply: (snapshot) => set({ items: snapshot.items, collections: snapshot.collections, loaded: true }),
}));

export function findItem(id: string): LibraryItem | undefined {
  return useLibrary.getState().items.find((item) => item.id === id);
}
