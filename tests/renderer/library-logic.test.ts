import { describe, expect, it } from 'vitest';
import type { Collection, LibraryItem } from '@shared/types';
import {
  collectionItems,
  filterCollections,
  filterItems,
  normalizeSearch,
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
