import { describe, expect, it } from 'vitest';
import { PLAYLIST_EMOJIS, isPlaylistEmoji } from '../../src/shared/playlist-emojis';
import { addIds, cleanPlaylistTitle, moveIds, removeIds } from '../../src/shared/playlist-ops';

describe('addIds', () => {
  it('appends new ids in the given order and counts the ones already there', () => {
    expect(addIds(['a', 'b'], ['c', 'a', 'd'])).toEqual({ itemIds: ['a', 'b', 'c', 'd'], added: 2, already: 1 });
  });

  it('counts an id repeated in the input once', () => {
    expect(addIds([], ['x', 'x'])).toEqual({ itemIds: ['x'], added: 1, already: 0 });
  });

  it('does not change the input list', () => {
    const current = ['a'];
    addIds(current, ['b']);
    expect(current).toEqual(['a']);
  });
});

describe('removeIds', () => {
  it('drops the given ids, ignores unknown ones and keeps the order', () => {
    expect(removeIds(['a', 'b', 'c', 'd'], ['b', 'd', 'zz'])).toEqual(['a', 'c']);
  });
});

describe('moveIds', () => {
  const list = ['a', 'b', 'c', 'd', 'e'];

  it('moves one id in front of another', () => {
    expect(moveIds(list, ['d'], 'b')).toEqual(['a', 'd', 'b', 'c', 'e']);
  });

  it('moves to the end when beforeId is null', () => {
    expect(moveIds(list, ['a'], null)).toEqual(['b', 'c', 'd', 'e', 'a']);
  });

  it('moves a block and keeps its relative order', () => {
    expect(moveIds(list, ['e', 'b'], 'a')).toEqual(['b', 'e', 'a', 'c', 'd']);
  });

  it('anchors on the next unmoved id when beforeId is itself being moved', () => {
    expect(moveIds(list, ['a', 'd'], 'd')).toEqual(['b', 'c', 'a', 'd', 'e']);
    expect(moveIds(list, ['b', 'c'], 'c')).toEqual(list);
  });

  it('ignores unknown ids and treats an unknown anchor as the end', () => {
    expect(moveIds(list, ['zz'], 'a')).toEqual(list);
    expect(moveIds(list, ['a'], 'zz')).toEqual(['b', 'c', 'd', 'e', 'a']);
  });
});

describe('cleanPlaylistTitle', () => {
  it('trims and accepts 1–80 characters', () => {
    expect(cleanPlaylistTitle('  Kedi videoları  ')).toBe('Kedi videoları');
    expect(cleanPlaylistTitle('x'.repeat(80))).toHaveLength(80);
  });

  it.each(['', '   ', 'x'.repeat(81), 'a\nb', 'tab\there', 42, null, undefined])('rejects %j', (value) => {
    expect(cleanPlaylistTitle(value)).toBeNull();
  });
});

describe('PLAYLIST_EMOJIS', () => {
  it('has 32 distinct emoji', () => {
    expect(PLAYLIST_EMOJIS).toHaveLength(32);
    expect(new Set(PLAYLIST_EMOJIS).size).toBe(32);
  });

  it('recognises only listed emoji', () => {
    expect(isPlaylistEmoji('🐱')).toBe(true);
    expect(isPlaylistEmoji('🦄')).toBe(false);
    expect(isPlaylistEmoji(1)).toBe(false);
  });
});
