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
  | 'close';

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

export function shortcutAction(key: string): ShortcutAction | null {
  return KEYS[key.toLowerCase()] ?? null;
}
