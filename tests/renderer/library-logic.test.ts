import { describe, expect, it } from 'vitest';
import type { Collection, LibraryItem } from '@shared/types';
import {
  collectionItems,
  filterCollections,
  filterItems,
  normalizeSearch,
  playableIds,
  resumeRatio,
} from '../../src/renderer/src/pages/library/library-logic';

const item = (id: string, overrides: Partial<LibraryItem> = {}): LibraryItem =>
  ({
    id,
    kind: 'video',
    title: id,
    channel: 'Kanal',
    addedAt: '2026-01-01',
    durationSec: 100,
    progress: { positionSec: 0, completed: false, updatedAt: '' },
    ...overrides,
  }) as LibraryItem;

describe('normalizeSearch', () => {
  it('ignores Turkish case and accents', () => {
    expect(normalizeSearch('Gülümse ŞARKI İstanbul')).toBe('gulumse sarki istanbul');
  });
});

describe('filterItems', () => {
  const items = [
    item('v1', { title: 'Belgesel', addedAt: '2026-01-02' }),
    item('a1', { kind: 'audio', title: 'Gülümse', artist: 'Sezen Aksu', addedAt: '2026-01-03' }),
    item('v2', { title: 'Ana sayfa', addedAt: '2026-01-01' }),
  ];

  it('filters by tab', () => {
    expect(filterItems(items, 'video', '', 'newest', 'tr-TR').map((i) => i.id)).toEqual(['v1', 'v2']);
    expect(filterItems(items, 'music', '', 'newest', 'tr-TR').map((i) => i.id)).toEqual(['a1']);
    expect(filterItems(items, 'all', '', 'newest', 'tr-TR').map((i) => i.id)).toEqual(['a1', 'v1', 'v2']);
  });

  it('searches titles, channels and artists without accents', () => {
    expect(filterItems(items, 'all', 'GULUMSE', 'newest', 'tr-TR').map((i) => i.id)).toEqual(['a1']);
    expect(filterItems(items, 'all', 'sezen', 'newest', 'tr-TR').map((i) => i.id)).toEqual(['a1']);
  });

  it('sorts by title with the locale', () => {
    const named = [item('1', { title: 'Zil' }), item('2', { title: 'Çiçek' }), item('3', { title: 'Ana' })];
    expect(filterItems(named, 'all', '', 'title', 'tr-TR').map((i) => i.title)).toEqual(['Ana', 'Çiçek', 'Zil']);
  });
});

describe('collections', () => {
  const collection = { id: 'c', title: 'Liste', itemIds: ['b', 'gone', 'a'] } as Collection;

  it('lists collection items in order and skips missing ids', () => {
    expect(collectionItems(collection, [item('a'), item('b')]).map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('filters collections by title', () => {
    expect(filterCollections([collection, { ...collection, id: 'd', title: 'Başka' }], 'lis', 'tr-TR').map((c) => c.id)).toEqual(['c']);
  });
});

describe('resumeRatio', () => {
  it('shows progress only for unfinished items', () => {
    expect(resumeRatio(item('a', { progress: { positionSec: 30, completed: false, updatedAt: '' } }))).toBe(0.3);
    expect(resumeRatio(item('a', { progress: { positionSec: 30, completed: true, updatedAt: '' } }))).toBe(0);
    expect(resumeRatio(item('a', { durationSec: 0, progress: { positionSec: 30, completed: false, updatedAt: '' } }))).toBe(0);
    expect(resumeRatio(item('a'))).toBe(0);
  });
});

describe('playableIds', () => {
  it('keeps the playable items of one kind in order', () => {
    const list = [
      item('a', { kind: 'video' }),
      item('b', { kind: 'audio' }),
      item('c', { kind: 'video', missing: true }),
      item('d', { kind: 'video' }),
    ];
    expect(playableIds(list, 'video')).toEqual(['a', 'd']);
    expect(playableIds(list, 'audio')).toEqual(['b']);
  });
});

describe('playlists in the shared helpers', () => {
  const playlist = (id: string, title: string, itemIds: string[] = []) => ({ id, title, itemIds, createdAt: '' });

  it('filters and sorts playlists by title like collections', () => {
    const list = [playlist('1', 'Yemek'), playlist('2', 'kedi videoları'), playlist('3', 'Komik')];
    expect(filterCollections(list, 'k', 'tr-TR').map((p) => p.id)).toEqual(['2', '3', '1']);
    expect(filterCollections(list, 'kedi', 'tr-TR').map((p) => p.id)).toEqual(['2']);
  });

  it('lists a playlist in its own order and skips ids that are gone', () => {
    const items = [item('a'), item('b')];
    expect(collectionItems(playlist('p', 'x', ['b', 'gone', 'a']), items).map((i) => i.id)).toEqual(['b', 'a']);
  });
});
