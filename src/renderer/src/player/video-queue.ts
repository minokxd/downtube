import type { LibraryItem } from '@shared/types';

export interface VideoQueue {
  ids: string[];
  index: number;
}

const playable = (item: LibraryItem | undefined): boolean => item !== undefined && item.kind === 'video' && !item.missing;

/** The next (1) or previous (-1) playable video in the queue, skipping deleted, missing and music items; null at the ends. */
export function stepIndex(queue: VideoQueue, step: 1 | -1, lookup: (id: string) => LibraryItem | undefined): number | null {
  for (let i = queue.index + step; i >= 0 && i < queue.ids.length; i += step) {
    const id = queue.ids[i];
    if (id !== undefined && playable(lookup(id))) return i;
  }
  return null;
}
