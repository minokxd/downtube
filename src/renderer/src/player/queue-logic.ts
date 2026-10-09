export type RepeatMode = 'off' | 'all' | 'one';

export function shuffleOrder(ids: readonly string[], firstId?: string, random: () => number = Math.random): string[] {
  const rest = ids.filter((id) => id !== firstId);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j] as string, rest[i] as string];
  }
  return firstId !== undefined && ids.includes(firstId) ? [firstId, ...rest] : rest;
}

/** `auto` is true when a track ended by itself, false when the user pressed next. */
export function nextIndex(length: number, index: number, repeat: RepeatMode, auto: boolean): number | null {
  if (length === 0) return null;
  if (auto && repeat === 'one') return index;
  if (index + 1 < length) return index + 1;
  return repeat === 'off' ? null : 0;
}

export function prevIndex(length: number, index: number, repeat: RepeatMode): number {
  if (length === 0) return 0;
  if (index > 0) return index - 1;
  return repeat === 'all' ? length - 1 : 0;
}

export function removeFromOrder(order: readonly string[], index: number, at: number): { order: string[]; index: number } {
  const next = order.filter((_, i) => i !== at);
  let current = index;
  if (at < index) current -= 1;
  else if (at === index) current = Math.min(index, next.length - 1);
  return { order: next, index: Math.max(0, current) };
}

export function moveInOrder(
  order: readonly string[],
  index: number,
  at: number,
  direction: -1 | 1,
): { order: string[]; index: number } {
  const to = at + direction;
  if (at < 0 || at >= order.length || to < 0 || to >= order.length) return { order: [...order], index };
  const next = [...order];
  [next[at], next[to]] = [next[to] as string, next[at] as string];
  const current = index === at ? to : index === to ? at : index;
  return { order: next, index: current };
}
