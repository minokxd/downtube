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

  it('attaches already-owned items to a collection in index order', async () => {
    const store = await LibraryStore.open(file);
    const a = await store.addFromDownload(input({}, 'aaaaaaaaaaa'));
    const b = await store.addFromDownload(input({}, 'bbbbbbbbbbb'));
    const ref = { youtubeId: 'PL1', kind: 'playlist' as const, title: 'My list' };
    const listener = vi.fn();
    store.onChange(listener);
    expect(await store.attachExisting('bbbbbbbbbbb', 'video', { ...ref, index: 1 })).toBe(true);
    expect(await store.attachExisting('aaaaaaaaaaa', 'video', { ...ref, index: 0 })).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);
    const { collections } = store.snapshot();
    expect(collections).toHaveLength(1);
    expect(collections[0]).toMatchObject({ youtubeId: 'PL1', kind: 'playlist', title: 'My list', itemIds: [a.id, b.id] });
    expect(store.get(a.id)?.collectionIds).toEqual([collections[0]?.id]);
    const reopened = await LibraryStore.open(file);
    expect(reopened.snapshot().collections[0]?.itemIds).toEqual([a.id, b.id]);
  });

  it('does not attach a video that is unknown, of another kind or missing', async () => {
    const store = await LibraryStore.open(file);
    await store.addFromDownload(input({}, 'aaaaaaaaaaa'));
    const missing = await store.addFromDownload(input({}, 'bbbbbbbbbbb'));
    await store.refreshMissing(async (path) => !path.includes('bbbbbbbbbbb'));
    expect(store.get(missing.id)?.missing).toBe(true);
    const listener = vi.fn();
    store.onChange(listener);
    const ref = { youtubeId: 'PL1', kind: 'playlist' as const, title: 'My list', index: 0 };
    expect(await store.attachExisting('zzzzzzzzzzz', 'video', ref)).toBe(false);
    expect(await store.attachExisting('aaaaaaaaaaa', 'audio', ref)).toBe(false);
    expect(await store.attachExisting('bbbbbbbbbbb', 'video', ref)).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    expect(store.snapshot().collections).toEqual([]);
  });

  it('removes items, trashes files on request and drops empty collections', async () => {
    const store = await LibraryStore.open(file);
    const item = await store.addFromDownload(
      input({
        collection: { youtubeId: 'PL1', kind: 'playlist', title: 'x', index: 0 },
        subtitles: [{ lang: 'en', label: 'en', path: join(dir, 'x.en.vtt') }],
      }),
    );
    const thumb = join(dir, 'jNQXAC9IVRw.jpg');
    const sub = join(dir, 'x.en.vtt');
    for (const path of [item.filePath, thumb, sub]) await writeFile(path, 'x');
    const trash = vi.fn(async (_path: string) => undefined);
    await store.remove(item.id, true, trash);
    expect(trash.mock.calls).toEqual([[item.filePath], [thumb], [sub]]);
    expect(store.snapshot()).toEqual({ items: [], collections: [], playlists: [] });
  });

  it('keeps files when removing from the library only', async () => {
    const store = await LibraryStore.open(file);
    const item = await store.addFromDownload(input());
    const trash = vi.fn(async () => undefined);
    await store.remove(item.id, false, trash);
    expect(trash).not.toHaveBeenCalled();
  });

  it('keeps the item and its collection when the media file cannot be trashed', async () => {
    const store = await LibraryStore.open(file);
    const item = await store.addFromDownload(input({ collection: { youtubeId: 'PL1', kind: 'playlist', title: 'x', index: 0 } }));
    await writeFile(item.filePath, 'x');
    const before = store.snapshot();
    const trash = vi.fn(async (_path: string) => {
      throw new Error('EBUSY: resource busy or locked');
    });
    await expect(store.remove(item.id, true, trash)).rejects.toThrow(item.filePath);
    expect(store.snapshot()).toEqual(before);
    const reopened = await LibraryStore.open(file);
    expect(reopened.get(item.id)?.title).toBe('Title jNQXAC9IVRw');
    expect(reopened.snapshot()).toEqual(before);
  });

  it('does not trash paths that are already gone', async () => {
    const store = await LibraryStore.open(file);
    const item = await store.addFromDownload(input({ subtitles: [{ lang: 'en', label: 'en', path: join(dir, 'jNQXAC9IVRw.en.vtt') }] }));
    await writeFile(item.filePath, 'x');
    const trash = vi.fn(async (_path: string) => undefined);
    await store.remove(item.id, true, trash);
    expect(trash.mock.calls).toEqual([[item.filePath]]);
    expect(store.snapshot().items).toEqual([]);
  });

  it('removes the item but reports sidecars that could not be trashed, without stopping at the first failure', async () => {
    const store = await LibraryStore.open(file);
    const thumb = join(dir, 'jNQXAC9IVRw.jpg');
    const enPath = join(dir, 'jNQXAC9IVRw.en.vtt');
    const trPath = join(dir, 'jNQXAC9IVRw.tr.vtt');
    const item = await store.addFromDownload(
      input({
        subtitles: [
          { lang: 'en', label: 'en', path: enPath },
          { lang: 'tr', label: 'tr', path: trPath },
        ],
      }),
    );
    for (const path of [item.filePath, thumb, enPath, trPath]) await writeFile(path, 'x');
    const trash = vi.fn(async (path: string) => {
      if (path === enPath) throw new Error('EBUSY: resource busy or locked');
    });
    await expect(store.remove(item.id, true, trash)).rejects.toThrow(enPath);
    expect(store.get(item.id)).toBeUndefined();
    expect(store.snapshot()).toEqual({ items: [], collections: [], playlists: [] });
    expect(trash.mock.calls.map(([path]) => path)).toEqual([item.filePath, thumb, enPath, trPath]);
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
    expect(store.snapshot()).toEqual({ items: [], collections: [], playlists: [] });
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

  it('keeps valid playlists and drops unknown or repeated items and foreign emoji', () => {
    const data = sanitizeLibrary({
      items: [validItem()],
      playlists: [
        { id: 'p1', title: '  Kediler  ', emoji: '🦄', itemIds: ['ok', 'gone', 'ok'], createdAt: 'x' },
        { id: 'p2', title: '   ', itemIds: [] },
        { id: 3, title: 'bad', itemIds: [] },
        { id: 'p4', title: 'ok', emoji: '🐱', itemIds: 'nope' },
      ],
    });
    expect(data.playlists).toEqual([{ id: 'p1', title: 'Kediler', itemIds: ['ok'], createdAt: 'x' }]);
  });

  it('starts with no playlists when an older file has none', () => {
    expect(sanitizeLibrary({ items: [], collections: [] }).playlists).toEqual([]);
  });
});

describe('playlists', () => {
  const video = (store: LibraryStore, videoId: string) => store.addFromDownload(input({}, videoId));

  it('creates, renames, sets and clears the emoji, and persists', async () => {
    const store = await LibraryStore.open(file);
    const playlist = await store.createPlaylist('Kedi videoları', '🐱');
    expect(playlist).toMatchObject({ title: 'Kedi videoları', emoji: '🐱', itemIds: [] });
    await store.updatePlaylist(playlist.id, { title: 'Kediler' });
    await store.updatePlaylist(playlist.id, { emoji: null });
    const saved = (await LibraryStore.open(file)).snapshot().playlists[0];
    expect(saved?.title).toBe('Kediler');
    expect(saved).not.toHaveProperty('emoji');
  });

  it('adds items once, in order, ignoring unknown ids, with one write per call', async () => {
    const store = await LibraryStore.open(file);
    const a = await video(store, 'aaaaaaaaaaa');
    const b = await video(store, 'bbbbbbbbbbb');
    const playlist = await store.createPlaylist('Mix');
    const changes = vi.fn();
    store.onChange(changes);
    expect(await store.addToPlaylist(playlist.id, [b.id, a.id, 'nope'])).toEqual({ added: 2, already: 0 });
    expect(changes).toHaveBeenCalledTimes(1);
    expect(await store.addToPlaylist(playlist.id, [a.id])).toEqual({ added: 0, already: 1 });
    expect(changes).toHaveBeenCalledTimes(1);
    expect(store.snapshot().playlists[0]?.itemIds).toEqual([b.id, a.id]);
  });

  it('reorders and removes items', async () => {
    const store = await LibraryStore.open(file);
    const ids: string[] = [];
    for (const videoId of ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']) ids.push((await video(store, videoId)).id);
    const [a, b, c] = ids as [string, string, string];
    const playlist = await store.createPlaylist('Mix');
    await store.addToPlaylist(playlist.id, ids);
    await store.movePlaylistItems(playlist.id, [c], a);
    expect(store.snapshot().playlists[0]?.itemIds).toEqual([c, a, b]);
    await store.removeFromPlaylist(playlist.id, [a]);
    expect(store.snapshot().playlists[0]?.itemIds).toEqual([c, b]);
  });

  it('deletes a playlist but keeps its videos', async () => {
    const store = await LibraryStore.open(file);
    const item = await video(store, 'aaaaaaaaaaa');
    const playlist = await store.createPlaylist('Mix');
    await store.addToPlaylist(playlist.id, [item.id]);
    await store.deletePlaylist(playlist.id);
    expect(store.snapshot().playlists).toEqual([]);
    expect(store.get(item.id)).toBeDefined();
  });

  it('drops a removed item from every playlist and keeps the emptied playlists', async () => {
    const store = await LibraryStore.open(file);
    const item = await video(store, 'aaaaaaaaaaa');
    const one = await store.createPlaylist('One');
    const two = await store.createPlaylist('Two');
    await store.addToPlaylist(one.id, [item.id]);
    await store.addToPlaylist(two.id, [item.id]);
    await store.remove(item.id, false, async () => undefined);
    expect(store.snapshot().playlists.map((p) => [p.title, p.itemIds])).toEqual([
      ['One', []],
      ['Two', []],
    ]);
  });

  it('rejects an unknown playlist id', async () => {
    const store = await LibraryStore.open(file);
    await expect(store.addToPlaylist('missing', ['x'])).rejects.toThrow('playlist not found');
    await expect(store.updatePlaylist('missing', { title: 'x' })).rejects.toThrow('playlist not found');
    await expect(store.deletePlaylist('missing')).rejects.toThrow('playlist not found');
  });
});
