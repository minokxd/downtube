export const PLAYLIST_TITLE_MAX = 80;

// Control characters (newlines, tabs, …) never belong in a name shown on one line.
const CONTROL = /[\u0000-\u001f\u007f]/;

/** The trimmed title, or null when it is not a usable playlist name. */
export function cleanPlaylistTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const title = value.trim();
  return title.length >= 1 && title.length <= PLAYLIST_TITLE_MAX && !CONTROL.test(title) ? title : null;
}

export interface AddIdsResult {
  itemIds: string[];
  added: number;
  already: number;
}

/** Appends the ids that are not in the list yet, in the given order. A repeated input id counts once. */
export function addIds(current: readonly string[], ids: readonly string[]): AddIdsResult {
  const itemIds = [...current];
  const seen = new Set(current);
  let added = 0;
  let already = 0;
  for (const id of new Set(ids)) {
    if (seen.has(id)) {
      already += 1;
      continue;
    }
    seen.add(id);
    itemIds.push(id);
    added += 1;
  }
  return { itemIds, added, already };
}

export function removeIds(current: readonly string[], ids: readonly string[]): string[] {
  const drop = new Set(ids);
  return current.filter((id) => !drop.has(id));
}

/**
 * Moves `ids` (keeping their current relative order) in front of `beforeId`, or to the end when it is
 * null or unknown. When `beforeId` is itself being moved, the first unmoved id after it is the anchor.
 * Ids that are not in the list are ignored.
 */
export function moveIds(current: readonly string[], ids: readonly string[], beforeId: string | null): string[] {
  const moving = new Set(ids.filter((id) => current.includes(id)));
  if (moving.size === 0) return [...current];
  let anchor = beforeId !== null && current.includes(beforeId) ? beforeId : null;
  if (anchor !== null && moving.has(anchor)) {
    anchor = current.slice(current.indexOf(anchor)).find((id) => !moving.has(id)) ?? null;
  }
  const block = current.filter((id) => moving.has(id));
  const rest = current.filter((id) => !moving.has(id));
  const at = anchor === null ? rest.length : rest.indexOf(anchor);
  return [...rest.slice(0, at), ...block, ...rest.slice(at)];
}
