import { describe, expect, it } from 'vitest';
import { shortcutAction } from '../../src/renderer/src/player/video-shortcuts';

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
