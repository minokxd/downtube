import type { Collection, LibraryItem } from '@shared/types';

export type LibraryTab = 'all' | 'video' | 'music' | 'collections';
export type LibrarySort = 'newest' | 'title';

export function normalizeSearch(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i');
}

export function filterItems(
  items: readonly LibraryItem[],
  tab: LibraryTab,
  query: string,
  sort: LibrarySort,
  locale: string,
): LibraryItem[] {
  const q = normalizeSearch(query.trim());
  const filtered = items.filter((item) => {
    if (tab === 'video' && item.kind !== 'video') return false;
    if (tab === 'music' && item.kind !== 'audio') return false;
    return q === '' || normalizeSearch(`${item.title} ${item.channel} ${item.artist ?? ''}`).includes(q);
  });
  return filtered.sort(
    sort === 'title'
      ? (a, b) => a.title.localeCompare(b.title, locale, { sensitivity: 'base' })
      : (a, b) => b.addedAt.localeCompare(a.addedAt),
  );
}

export function filterCollections(collections: readonly Collection[], query: string, locale: string): Collection[] {
  const q = normalizeSearch(query.trim());
  return collections
    .filter((collection) => q === '' || normalizeSearch(collection.title).includes(q))
    .sort((a, b) => a.title.localeCompare(b.title, locale, { sensitivity: 'base' }));
}

export function collectionItems(collection: Collection, items: readonly LibraryItem[]): LibraryItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return collection.itemIds.map((id) => byId.get(id)).filter((item): item is LibraryItem => item !== undefined);
}

export function resumeRatio(item: LibraryItem): number {
  if (item.progress.completed || item.durationSec <= 0) return 0;
  const ratio = item.progress.positionSec / item.durationSec;
  return ratio > 0.01 ? Math.min(1, ratio) : 0;
}
