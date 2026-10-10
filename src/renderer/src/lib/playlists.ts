import type { LibraryItem, Playlist, PlaylistAddResult } from '@shared/types';
import type { MessageKey } from '../i18n';
import type { TranslateVars } from '../i18n/translate';

export function sortPlaylists(playlists: readonly Playlist[], locale: string): Playlist[] {
  return [...playlists].sort((a, b) => a.title.localeCompare(b.title, locale, { sensitivity: 'base' }));
}

export function addResultMessage(result: PlaylistAddResult, title: string): { key: MessageKey; vars: TranslateVars } {
  if (result.added === 0) return { key: 'playlist.addedNone', vars: { title } };
  if (result.already === 0) return { key: 'playlist.added', vars: { title, count: result.added } };
  return { key: 'playlist.addedSome', vars: { title, count: result.added, already: result.already } };
}

export function totalDuration(items: readonly LibraryItem[]): number {
  return items.reduce((sum, item) => sum + Math.max(0, item.durationSec), 0);
}

/** The item whose thumbnail stands in for a playlist that has no emoji. */
export function coverItem(items: readonly LibraryItem[]): LibraryItem | undefined {
  return items.find((item) => item.thumbPath !== undefined);
}

/**
 * The `beforeId` that moves `id` one step earlier (-1) or later (1): null means "to the end",
 * undefined means it cannot move that way.
 */
export function stepAnchor(itemIds: readonly string[], id: string, direction: -1 | 1): string | null | undefined {
  const index = itemIds.indexOf(id);
  if (index < 0) return undefined;
  if (direction === -1) return index === 0 ? undefined : itemIds[index - 1];
  if (index >= itemIds.length - 1) return undefined;
  return itemIds[index + 2] ?? null;
}
