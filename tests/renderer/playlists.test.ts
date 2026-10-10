import { describe, expect, it } from 'vitest';
import type { LibraryItem, Playlist } from '@shared/types';
import { addResultMessage, coverItem, sortPlaylists, stepAnchor, totalDuration } from '../../src/renderer/src/lib/playlists';

const playlist = (title: string): Playlist => ({ id: title, title, itemIds: [], createdAt: '' });
const media = (id: string, durationSec: number, thumbPath?: string) =>
  ({ id, durationSec, thumbPath }) as unknown as LibraryItem;

describe('sortPlaylists', () => {
  it('sorts by title with Turkish collation and leaves the input alone', () => {
    const input = [playlist('şarkılar'), playlist('Kediler'), playlist('çalışma'), playlist('arabada')];
    expect(sortPlaylists(input, 'tr-TR').map((p) => p.title)).toEqual(['arabada', 'çalışma', 'Kediler', 'şarkılar']);
    expect(input[0]?.title).toBe('şarkılar');
  });
});

describe('addResultMessage', () => {
  it('picks the message for added, partly added and nothing added', () => {
    expect(addResultMessage({ added: 3, already: 0 }, 'Kediler')).toEqual({ key: 'playlist.added', vars: { title: 'Kediler', count: 3 } });
    expect(addResultMessage({ added: 2, already: 1 }, 'Kediler')).toEqual({
      key: 'playlist.addedSome',
      vars: { title: 'Kediler', count: 2, already: 1 },
    });
    expect(addResultMessage({ added: 0, already: 2 }, 'Kediler')).toEqual({ key: 'playlist.addedNone', vars: { title: 'Kediler' } });
  });
});

describe('totalDuration', () => {
  it('adds up durations and ignores negative ones', () => {
    expect(totalDuration([media('a', 60), media('b', -5), media('c', 30)])).toBe(90);
  });
});

describe('coverItem', () => {
  it('takes the first item that has a thumbnail', () => {
    expect(coverItem([media('a', 1), media('b', 1, 'b.jpg'), media('c', 1, 'c.jpg')])?.id).toBe('b');
    expect(coverItem([media('a', 1)])).toBeUndefined();
  });
});

describe('stepAnchor', () => {
  const list = ['a', 'b', 'c'];

  it('moves one step earlier by anchoring on the previous id', () => {
    expect(stepAnchor(list, 'b', -1)).toBe('a');
    expect(stepAnchor(list, 'a', -1)).toBeUndefined();
  });

  it('moves one step later by anchoring two ahead, or at the end', () => {
    expect(stepAnchor(list, 'a', 1)).toBe('c');
    expect(stepAnchor(list, 'b', 1)).toBeNull();
    expect(stepAnchor(list, 'c', 1)).toBeUndefined();
  });

  it('cannot move an id that is not in the list', () => {
    expect(stepAnchor(list, 'zz', 1)).toBeUndefined();
  });
});
