/** Library items in a drag: a JSON array of item ids. Only the app's own drags carry this type. */
export const ITEMS_MIME = 'application/x-downtube-items';

export function writeDragItems(dataTransfer: DataTransfer, ids: readonly string[]): void {
  dataTransfer.setData(ITEMS_MIME, JSON.stringify(ids));
  dataTransfer.effectAllowed = 'copyMove';
}

/** Usable during dragover, when the browser hides the data itself and shows only its types. */
export const hasDragItems = (dataTransfer: DataTransfer): boolean => Array.from(dataTransfer.types).includes(ITEMS_MIME);

export function readDragItems(dataTransfer: DataTransfer): string[] {
  try {
    const parsed: unknown = JSON.parse(dataTransfer.getData(ITEMS_MIME));
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export type DropSide = 'before' | 'after';

export const dropSide = (pointerX: number, rect: { left: number; width: number }): DropSide =>
  pointerX < rect.left + rect.width / 2 ? 'before' : 'after';

/** The id to insert in front of when dropping on `overId`'s `side`; null means the end of the list. */
export function anchorFor(order: readonly string[], overId: string, side: DropSide): string | null {
  const index = order.indexOf(overId);
  if (index < 0) return null;
  return side === 'before' ? overId : (order[index + 1] ?? null);
}

/** A drag image that says how many items move; it lives off screen and is removed once the browser has drawn it. */
export function setCountDragImage(dataTransfer: DataTransfer, label: string): void {
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.textContent = label;
  document.body.append(ghost);
  dataTransfer.setDragImage(ghost, 16, 16);
  window.setTimeout(() => ghost.remove(), 0);
}
