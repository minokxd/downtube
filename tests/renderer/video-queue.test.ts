import { describe, expect, it } from 'vitest';
import type { LibraryItem } from '@shared/types';
import { stepIndex } from '../../src/renderer/src/player/video-queue';

const item = (id: string, overrides: Partial<LibraryItem> = {}): LibraryItem => ({
  id,
  videoId: id,
  kind: 'video',
  title: id,
  channel: '',
  durationSec: 10,
  filePath: `C:\\${id}.mp4`,
  subtitles: [],
  sizeBytes: 1,
  addedAt: '',
  sourceUrl: '',
  collectionIds: [],
  progress: { positionSec: 0, updatedAt: '', completed: false },
  playCount: 0,
  ...overrides,
});

const library = new Map([
  ['a', item('a')],
  ['b', item('b', { missing: true })],
  ['c', item('c', { kind: 'audio' })],
  ['d', item('d')],
]);
const lookup = (id: string) => library.get(id);

describe('stepIndex', () => {
  it('skips missing, music and deleted items going forward', () => {
    expect(stepIndex({ ids: ['a', 'b', 'c', 'gone', 'd'], index: 0 }, 1, lookup)).toBe(4);
  });

  it('steps back over skipped items', () => {
    expect(stepIndex({ ids: ['a', 'b', 'd'], index: 2 }, -1, lookup)).toBe(0);
  });

  it('returns null at the ends or when nothing playable is left', () => {
    expect(stepIndex({ ids: ['a', 'd'], index: 1 }, 1, lookup)).toBeNull();
    expect(stepIndex({ ids: ['a', 'd'], index: 0 }, -1, lookup)).toBeNull();
    expect(stepIndex({ ids: ['a', 'b', 'c'], index: 0 }, 1, lookup)).toBeNull();
  });
});
