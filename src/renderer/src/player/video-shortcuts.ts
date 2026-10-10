export type ShortcutAction =
  | 'toggle'
  | 'back5'
  | 'forward5'
  | 'back10'
  | 'forward10'
  | 'volumeUp'
  | 'volumeDown'
  | 'fullscreen'
  | 'mute'
  | 'subtitles'
  | 'close'
  | 'next'
  | 'previous';

const KEYS: Record<string, ShortcutAction> = {
  ' ': 'toggle',
  k: 'toggle',
  arrowleft: 'back5',
  arrowright: 'forward5',
  j: 'back10',
  l: 'forward10',
  arrowup: 'volumeUp',
  arrowdown: 'volumeDown',
  f: 'fullscreen',
  m: 'mute',
  c: 'subtitles',
  escape: 'close',
};

// Holding these keys keeps seeking / changing the volume; everything else fires once per key press.
const REPEATABLE: ReadonlySet<ShortcutAction> = new Set(['back5', 'forward5', 'back10', 'forward10', 'volumeUp', 'volumeDown']);

export const repeatsWhenHeld = (action: ShortcutAction): boolean => REPEATABLE.has(action);

// Shift+N / Shift+P move through a video queue, as on YouTube.
const SHIFT_KEYS: Record<string, ShortcutAction> = { n: 'next', p: 'previous' };

export function shortcutAction(key: string, shift = false): ShortcutAction | null {
  const lower = key.toLowerCase();
  if (shift && Object.hasOwn(SHIFT_KEYS, lower)) return SHIFT_KEYS[lower] ?? null;
  return KEYS[lower] ?? null;
}
