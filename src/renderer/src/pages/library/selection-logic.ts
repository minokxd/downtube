export interface Selection {
  ids: ReadonlySet<string>;
  /** Where the next Shift+click range starts. */
  anchor: string | null;
}

export const EMPTY_SELECTION: Selection = { ids: new Set(), anchor: null };

export function toggleSelect(selection: Selection, id: string): Selection {
  const ids = new Set(selection.ids);
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  return { ids, anchor: id };
}

/** Adds every id between the anchor and `id`, in display order. Without a usable anchor it adds just `id`. */
export function rangeSelect(selection: Selection, order: readonly string[], id: string): Selection {
  const to = order.indexOf(id);
  if (to < 0) return selection;
  const from = selection.anchor === null ? -1 : order.indexOf(selection.anchor);
  if (from < 0) return { ids: new Set([...selection.ids, id]), anchor: id };
  const [start, end] = from <= to ? [from, to] : [to, from];
  return { ids: new Set([...selection.ids, ...order.slice(start, end + 1)]), anchor: selection.anchor };
}

/** Drops ids that are no longer shown; returns the same object when nothing changed. */
export function pruneSelection(selection: Selection, shown: ReadonlySet<string>): Selection {
  const ids = [...selection.ids].filter((id) => shown.has(id));
  if (ids.length === selection.ids.size) return selection;
  return { ids: new Set(ids), anchor: selection.anchor !== null && shown.has(selection.anchor) ? selection.anchor : null };
}

/** The ids an action on `id` applies to: the whole selection (in display order) when `id` is in it, otherwise just `id`. */
export function targetIds(selection: Selection, order: readonly string[], id: string): string[] {
  return selection.ids.has(id) ? order.filter((x) => selection.ids.has(x)) : [id];
}
