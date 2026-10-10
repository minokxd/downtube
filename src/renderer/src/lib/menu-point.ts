interface ContextMenuEventLike {
  clientX: number;
  clientY: number;
  currentTarget: { getBoundingClientRect(): { left: number; bottom: number } };
}

/** Where a context menu opens: at the pointer, or under the element when it was opened from the keyboard. */
export function menuPoint(event: ContextMenuEventLike): { x: number; y: number } {
  if (event.clientX !== 0 || event.clientY !== 0) return { x: event.clientX, y: event.clientY };
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: rect.left + 16, y: rect.bottom };
}
