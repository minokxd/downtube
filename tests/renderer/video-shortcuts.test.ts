import { describe, expect, it } from 'vitest';
import { repeatsWhenHeld, shortcutAction, type ShortcutAction } from '../../src/renderer/src/player/video-shortcuts';

describe('shortcutAction', () => {
  it.each([
    [' ', 'toggle'],
    ['k', 'toggle'],
    ['K', 'toggle'],
    ['ArrowLeft', 'back5'],
    ['ArrowRight', 'forward5'],
    ['j', 'back10'],
    ['l', 'forward10'],
    ['ArrowUp', 'volumeUp'],
    ['ArrowDown', 'volumeDown'],
    ['f', 'fullscreen'],
    ['m', 'mute'],
    ['c', 'subtitles'],
    ['Escape', 'close'],
  ])('maps %j to %s', (key, action) => {
    expect(shortcutAction(key)).toBe(action);
  });

  it('ignores other keys', () => {
    expect(shortcutAction('x')).toBeNull();
    expect(shortcutAction('Enter')).toBeNull();
  });
});

describe('repeatsWhenHeld', () => {
  it.each(['back5', 'forward5', 'back10', 'forward10', 'volumeUp', 'volumeDown'] as ShortcutAction[])('lets %s repeat while the key is held', (action) => {
    expect(repeatsWhenHeld(action)).toBe(true);
  });

  it.each(['toggle', 'fullscreen', 'mute', 'subtitles', 'close'] as ShortcutAction[])('fires %s only once per key press', (action) => {
    expect(repeatsWhenHeld(action)).toBe(false);
  });
});
