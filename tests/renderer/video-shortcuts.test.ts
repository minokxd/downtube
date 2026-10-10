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

  it('maps Shift+N and Shift+P to next and previous', () => {
    expect(shortcutAction('N', true)).toBe('next');
    expect(shortcutAction('P', true)).toBe('previous');
  });

  it('ignores N and P without Shift and keeps the other keys under Shift', () => {
    expect(shortcutAction('n')).toBeNull();
    expect(shortcutAction('p')).toBeNull();
    expect(shortcutAction('K', true)).toBe('toggle');
  });
});

describe('repeatsWhenHeld', () => {
  it.each(['back5', 'forward5', 'back10', 'forward10', 'volumeUp', 'volumeDown'] as ShortcutAction[])('lets %s repeat while the key is held', (action) => {
    expect(repeatsWhenHeld(action)).toBe(true);
  });

  it.each(['toggle', 'fullscreen', 'mute', 'subtitles', 'close', 'next', 'previous'] as ShortcutAction[])('fires %s only once per key press', (action) => {
    expect(repeatsWhenHeld(action)).toBe(false);
  });
});
