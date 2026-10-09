import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryStore, sanitizeLibrary, type AddFromDownloadInput } from '../../src/main/library/library-store';

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'downtube-library-'));
  file = join(dir, 'library.json');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const input = (overrides: Partial<AddFromDownloadInput> = {}, id = 'jNQXAC9IVRw'): AddFromDownloadInput => ({
  done: { id, title: `Title ${id}`, channel: 'jawed', channelId: 'UC1', durationSec: 100, filepath: join(dir, `${id}.mp4`) },
  kind: 'video',
  sourceUrl: `https://www.youtube.com/watch?v=${id}`,
  thumbPath: join(dir, `${id}.jpg`),
  subtitles: [],
  sizeBytes: 1234,
  ...overrides,
});

function validItem() {
  return {
    id: 'ok',
    videoId: 'jNQXAC9IVRw',
    kind: 'video',
    title: 't',
    channel: 'c',
    durationSec: 1,
    filePath: 'C:\\x.mp4',
    subtitles: [],
    sizeBytes: 1,
    addedAt: '',
    sourceUrl: '',
    collectionIds: [],
    progress: { positionSec: 0, updatedAt: '', completed: false },
    playCount: 0,
  };
}

describe('LibraryStore', () => {
  it('adds a downloaded item and persists it', async () => {
    const store = await LibraryStore.open(file);
    const item = await store.addFromDownload(input());
    expect(item).toMatchObject({
      videoId: 'jNQXAC9IVRw',
      kind: 'video',
      title: 'Title jNQXAC9IVRw',
      channel: 'jawed',
      durationSec: 100,
      sizeBytes: 1234,
      playCount: 0,
      progress: { positionSec: 0, completed: false },
    });
    expect(item.artist).toBeUndefined();
    const reopened = await LibraryStore.open(file);
    expect(reopened.get(item.id)?.title).toBe('Title jNQXAC9IVRw');
  });

  it('uses the channel as the artist for music', async () => {
    const store = await LibraryStore.open(file);
    const item = await store.addFromDownload(input({ kind: 'audio' }));
    expect(item.artist).toBe('jawed');
  });

  it('replaces an existing entry for the same video and kind but keeps its history', async () => {
    const store = await LibraryStore.open(file);
    const first = await store.addFromDownload(input());
    await store.saveProgress(first.id, 40);
    const second = await store.addFromDownload(input({ sizeBytes: 999 }));
    expect(second.id).toBe(first.id);
    expect(second.sizeBytes).toBe(999);
    expect(second.progress.positionSec).toBe(40);
    expect(store.snapshot().items).toHaveLength(1);
  });

  it('groups playlist items into an ordered collection', async () => {
    const store = await LibraryStore.open(file);
    const ref = { youtubeId: 'PL1', kind: 'playlist' as const, title: 'My list' };
    const b = await store.addFromDownload(input({ collection: { ...ref, index: 1 } }, 'bbbbbbbbbbb'));
    const a = await store.addFromDownload(input({ collection: { ...ref, index: 0 } }, 'aaaaaaaaaaa'));
    const [collection] = store.snapshot().collections;
    expect(collection).toMatchObject({ youtubeId: 'PL1', kind: 'playlist', title: 'My list', itemIds: [a.id, b.id] });
    expect(collection?.thumbPath).toBe(join(dir, 'bbbbbbbbbbb.jpg'));
    expect(store.get(a.id)?.collectionIds).toEqual([collection?.id]);
  });

  it('removes items, trashes files on request and drops empty collections', async () => {
    const store = await LibraryStore.open(file);
    const item = await store.addFromDownload(
      input({
        collection: { youtubeId: 'PL1', kind: 'playlist', title: 'x', index: 0 },
        subtitles: [{ lang: 'en', label: 'en', path: join(dir, 'x.en.vtt') }],
      }),
    );
    const trash = vi.fn(async () => undefined);
    await store.remove(item.id, true, trash);
    expect(trash).toHaveBeenCalledTimes(3);
    expect(store.snapshot()).toEqual({ items: [], collections: [] });
  });

  it('keeps files when removing from the library only', async () => {
    const store = await LibraryStore.open(file);
    const item = await store.addFromDownload(input());
    const trash = vi.fn(async () => undefined);
    await store.remove(item.id, false, trash);
    expect(trash).not.toHaveBeenCalled();
  });

  it('marks items completed near the end and learns the duration', async () => {
    const store = await LibraryStore.open(file);
    const item = await store.addFromDownload(input({ done: { ...input().done, durationSec: undefined } }));
    await store.saveProgress(item.id, 96, 100);
    expect(store.get(item.id)?.durationSec).toBe(100);
    expect(store.get(item.id)?.progress).toMatchObject({ positionSec: 96, completed: true });
    await store.saveProgress(item.id, 30);
    expect(store.get(item.id)?.progress).toMatchObject({ positionSec: 30, completed: false });
  });

  it('counts plays', async () => {
    const store = await LibraryStore.open(file);
    const item = await store.addFromDownload(input());
    await store.markPlayed(item.id);
    expect(store.get(item.id)?.playCount).toBe(1);
  });

  it('flags missing files and treats them as not playable', async () => {
    const store = await LibraryStore.open(file);
    const item = await store.addFromDownload(input());
    await store.refreshMissing(async () => false);
    expect(store.get(item.id)?.missing).toBe(true);
    expect(store.hasPlayable('jNQXAC9IVRw', 'video')).toBe(false);
    await store.refreshMissing(async () => true);
    expect(store.get(item.id)?.missing).toBeUndefined();
    expect(store.hasPlayable('jNQXAC9IVRw', 'video')).toBe(true);
  });

  it('notifies listeners on change', async () => {
    const store = await LibraryStore.open(file);
    const listener = vi.fn();
    store.onChange(listener);
    await store.addFromDownload(input());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('recovers from a corrupt file', async () => {
    await writeFile(file, 'not json', 'utf8');
    const store = await LibraryStore.open(file);
    expect(store.recovered).toBe('reset');
    expect(store.snapshot()).toEqual({ items: [], collections: [] });
  });
});

describe('sanitizeLibrary', () => {
  it('drops malformed entries and dangling collection references', () => {
    const data = sanitizeLibrary({
      items: [{ id: 'x' }, validItem()],
      collections: [{ id: 'c', youtubeId: 'PL', kind: 'playlist', title: 't', itemIds: ['ok', 'gone'], positions: {}, createdAt: '' }],
    });
    expect(data.items.map((i) => i.id)).toEqual(['ok']);
    expect(data.collections[0]?.itemIds).toEqual(['ok']);
  });
});
