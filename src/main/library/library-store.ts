import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { cleanChapters } from '@shared/chapters';
import { isPlaylistEmoji } from '@shared/playlist-emojis';
import { addIds, cleanPlaylistTitle, moveIds, removeIds } from '@shared/playlist-ops';
import { cleanSpotifyTrack } from '@shared/spotify-track';
import type {
  Collection,
  JobCollectionRef,
  LibraryItem,
  LibrarySnapshot,
  MediaKind,
  Playlist,
  PlaylistAddResult,
  PlaylistPatch,
  SpotifyTrack,
  SubtitleTrack,
} from '@shared/types';
import { JsonFile, type RecoveryState } from '../json-store';
import type { DoneInfo } from '../ytdlp/output';

export interface LibraryData {
  version: 1;
  items: LibraryItem[];
  collections: Collection[];
  playlists: Playlist[];
}

export interface AddFromDownloadInput {
  done: DoneInfo;
  kind: MediaKind;
  sourceUrl: string;
  collection?: JobCollectionRef;
  thumbPath?: string;
  subtitles: SubtitleTrack[];
  sizeBytes: number;
  spotify?: SpotifyTrack;
}

const COMPLETE_RATIO = 0.95;

const emptyData = (): LibraryData => ({ version: 1, items: [], collections: [], playlists: [] });

function isLibraryItem(value: unknown): value is LibraryItem {
  if (typeof value !== 'object' || value === null) return false;
  const i = value as Partial<LibraryItem>;
  return (
    typeof i.id === 'string' &&
    typeof i.videoId === 'string' &&
    (i.kind === 'video' || i.kind === 'audio') &&
    typeof i.title === 'string' &&
    typeof i.filePath === 'string' &&
    typeof i.progress === 'object' &&
    i.progress !== null &&
    Array.isArray(i.subtitles) &&
    Array.isArray(i.collectionIds)
  );
}

function isCollection(value: unknown): value is Collection {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Partial<Collection>;
  return (
    typeof c.id === 'string' &&
    typeof c.youtubeId === 'string' &&
    (c.kind === 'playlist' || c.kind === 'channel' || c.kind === 'album') &&
    typeof c.title === 'string' &&
    Array.isArray(c.itemIds) &&
    typeof c.positions === 'object' &&
    c.positions !== null
  );
}

function withCleanChapters(item: LibraryItem): LibraryItem {
  if (item.chapters === undefined) return item;
  const { chapters, ...rest } = item;
  const clean = cleanChapters(chapters);
  return clean.length > 0 ? { ...rest, chapters: clean } : rest;
}

function withCleanSpotify(item: LibraryItem): LibraryItem {
  if (item.spotify === undefined) return item;
  const { spotify, ...rest } = item;
  const clean = cleanSpotifyTrack(spotify);
  return clean ? { ...rest, spotify: clean } : rest;
}

function sanitizePlaylist(value: unknown, itemIds: ReadonlySet<string>): Playlist | null {
  if (typeof value !== 'object' || value === null) return null;
  const p = value as Partial<Playlist>;
  const title = cleanPlaylistTitle(p.title);
  if (typeof p.id !== 'string' || title === null || !Array.isArray(p.itemIds)) return null;
  const playlist: Playlist = {
    id: p.id,
    title,
    itemIds: [...new Set(p.itemIds.filter((id): id is string => typeof id === 'string' && itemIds.has(id)))],
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : '',
  };
  if (isPlaylistEmoji(p.emoji)) playlist.emoji = p.emoji;
  return playlist;
}

// Only a missing path counts as "already gone". Any other access error is left for
// trash to report, so a locked or unreadable file is never dropped silently.
async function existsOnDisk(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code !== 'ENOENT';
  }
}

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export function sanitizeLibrary(raw: unknown): LibraryData {
  if (typeof raw !== 'object' || raw === null) return emptyData();
  const r = raw as { items?: unknown; collections?: unknown; playlists?: unknown };
  const items = Array.isArray(r.items) ? r.items.filter(isLibraryItem).map(withCleanChapters).map(withCleanSpotify) : [];
  const ids = new Set(items.map((item) => item.id));
  const collections = Array.isArray(r.collections)
    ? r.collections.filter(isCollection).map((c) => ({ ...c, itemIds: c.itemIds.filter((id) => ids.has(id)) }))
    : [];
  // Files written before playlists existed have no such field.
  const playlists = Array.isArray(r.playlists)
    ? r.playlists.map((p) => sanitizePlaylist(p, ids)).filter((p): p is Playlist => p !== null)
    : [];
  return { version: 1, items, collections, playlists };
}

export class LibraryStore {
  private readonly listeners = new Set<() => void>();

  private constructor(
    private readonly file: JsonFile<LibraryData>,
    private data: LibraryData,
    readonly recovered: RecoveryState,
  ) {}

  static async open(filePath: string): Promise<LibraryStore> {
    const file = new JsonFile<LibraryData>(filePath);
    const { value, recovered } = await file.read(emptyData, sanitizeLibrary);
    return new LibraryStore(file, value, recovered);
  }

  snapshot(): LibrarySnapshot {
    return structuredClone({ items: this.data.items, collections: this.data.collections, playlists: this.data.playlists });
  }

  get(id: string): LibraryItem | undefined {
    return this.data.items.find((item) => item.id === id);
  }

  getCollection(id: string): Collection | undefined {
    return this.data.collections.find((c) => c.id === id);
  }

  findByVideo(videoId: string, kind: MediaKind): LibraryItem | undefined {
    return this.data.items.find((item) => item.videoId === videoId && item.kind === kind);
  }

  findBySpotify(spotifyId: string): LibraryItem | undefined {
    return this.data.items.find((item) => item.kind === 'audio' && item.spotify?.id === spotifyId);
  }

  /** A Spotify song is found by its Spotify id, since its YouTube match is only known once it downloads. */
  private findOwned(videoId: string, kind: MediaKind, spotifyId?: string): LibraryItem | undefined {
    return (spotifyId ? this.findBySpotify(spotifyId) : undefined) ?? (videoId ? this.findByVideo(videoId, kind) : undefined);
  }

  hasPlayable(videoId: string, kind: MediaKind, spotifyId?: string): boolean {
    const item = this.findOwned(videoId, kind, spotifyId);
    return item !== undefined && !item.missing;
  }

  async addFromDownload(input: AddFromDownloadInput): Promise<LibraryItem> {
    const now = new Date().toISOString();
    const existing = this.findOwned(input.done.id, input.kind, input.spotify?.id);
    const item: LibraryItem = {
      id: existing?.id ?? randomUUID(),
      videoId: input.done.id,
      kind: input.kind,
      title: input.spotify?.title ?? input.done.title,
      channel: input.done.channel ?? '',
      channelId: input.done.channelId,
      artist: input.kind === 'audio' ? (input.spotify?.artist || input.done.artist || input.done.channel) : undefined,
      durationSec: input.done.durationSec ?? 0,
      filePath: input.done.filepath,
      thumbPath: input.thumbPath,
      subtitles: input.subtitles,
      sizeBytes: input.sizeBytes,
      addedAt: existing?.addedAt ?? now,
      sourceUrl: input.sourceUrl,
      collectionIds: existing?.collectionIds ?? [],
      progress: existing?.progress ?? { positionSec: 0, updatedAt: now, completed: false },
      playCount: existing?.playCount ?? 0,
    };
    // A new download replaces the chapters too, so a video whose chapters were removed loses them.
    if (input.done.chapters && input.done.chapters.length > 0) item.chapters = input.done.chapters;
    if (input.spotify) item.spotify = input.spotify;
    if (existing) this.data.items[this.data.items.indexOf(existing)] = item;
    else this.data.items.push(item);
    if (input.collection) this.attachToCollection(item, input.collection, now);
    await this.commit();
    return structuredClone(item);
  }

  /** Adds a video that is already in the library to the collection of a playlist/channel download. */
  async attachExisting(videoId: string, kind: MediaKind, ref: JobCollectionRef, spotifyId?: string): Promise<boolean> {
    const item = this.findOwned(videoId, kind, spotifyId);
    if (!item || item.missing) return false;
    this.attachToCollection(item, ref, new Date().toISOString());
    await this.commit();
    return true;
  }

  private attachToCollection(item: LibraryItem, ref: JobCollectionRef, now: string): void {
    let collection = this.data.collections.find((c) => c.youtubeId === ref.youtubeId && c.kind === ref.kind);
    if (!collection) {
      collection = {
        id: randomUUID(),
        youtubeId: ref.youtubeId,
        kind: ref.kind,
        title: ref.title,
        thumbPath: item.thumbPath,
        itemIds: [],
        positions: {},
        createdAt: now,
      };
      this.data.collections.push(collection);
    }
    const target = collection;
    if (!target.thumbPath && item.thumbPath) target.thumbPath = item.thumbPath;
    target.positions[item.id] = ref.index;
    if (!target.itemIds.includes(item.id)) target.itemIds.push(item.id);
    target.itemIds.sort((a, b) => (target.positions[a] ?? 0) - (target.positions[b] ?? 0));
    if (!item.collectionIds.includes(target.id)) item.collectionIds.push(target.id);
  }

  async remove(id: string, deleteFiles: boolean, trash: (path: string) => Promise<void>): Promise<void> {
    const item = this.get(id);
    if (!item) return;
    const leftovers: string[] = [];
    if (deleteFiles) {
      // The media file goes first: if it cannot be trashed, the library stays unchanged.
      if (await existsOnDisk(item.filePath)) {
        try {
          await trash(item.filePath);
        } catch (err) {
          throw new Error(`Could not move ${item.filePath} to the trash: ${errorMessage(err)}`, { cause: err });
        }
      }
      // Sidecars are best effort: keep going past failures and report them after the commit.
      const sidecars = [item.thumbPath, ...item.subtitles.map((s) => s.path)];
      for (const path of sidecars) {
        if (!path || !(await existsOnDisk(path))) continue;
        try {
          await trash(path);
        } catch {
          leftovers.push(path);
        }
      }
    }
    this.data.items = this.data.items.filter((i) => i.id !== id);
    for (const collection of this.data.collections) {
      if (!collection.itemIds.includes(id)) continue;
      collection.itemIds = collection.itemIds.filter((x) => x !== id);
      delete collection.positions[id];
      if (collection.thumbPath === item.thumbPath) {
        collection.thumbPath = collection.itemIds.map((x) => this.get(x)?.thumbPath).find((p) => p !== undefined);
      }
    }
    // The user's playlists stay even when this empties them; only downloaded collections go away when empty.
    for (const playlist of this.data.playlists) playlist.itemIds = playlist.itemIds.filter((x) => x !== id);
    this.data.collections = this.data.collections.filter((c) => c.itemIds.length > 0);
    await this.commit();
    if (leftovers.length > 0) throw new Error(`Could not move these files to the trash: ${leftovers.join(', ')}`);
  }

  async saveProgress(id: string, positionSec: number, durationSec?: number): Promise<void> {
    const item = this.get(id);
    if (!item) return;
    if (item.durationSec <= 0 && durationSec !== undefined && durationSec > 0) item.durationSec = durationSec;
    const position = Math.max(0, positionSec);
    const completed = item.durationSec > 0 && position >= item.durationSec * COMPLETE_RATIO;
    item.progress = { positionSec: position, updatedAt: new Date().toISOString(), completed };
    await this.commit();
  }

  async markPlayed(id: string): Promise<void> {
    const item = this.get(id);
    if (!item) return;
    item.playCount += 1;
    await this.commit();
  }

  async refreshMissing(exists: (path: string) => Promise<boolean>): Promise<void> {
    let changed = false;
    for (const item of this.data.items) {
      const missing = !(await exists(item.filePath));
      if (Boolean(item.missing) === missing) continue;
      if (missing) item.missing = true;
      else delete item.missing;
      changed = true;
    }
    if (changed) await this.commit();
  }

  async createPlaylist(title: string, emoji?: string): Promise<Playlist> {
    const playlist: Playlist = { id: randomUUID(), title, itemIds: [], createdAt: new Date().toISOString() };
    if (emoji !== undefined) playlist.emoji = emoji;
    this.data.playlists.push(playlist);
    await this.commit();
    return structuredClone(playlist);
  }

  async updatePlaylist(id: string, patch: PlaylistPatch): Promise<void> {
    const playlist = this.playlist(id);
    if (patch.title !== undefined) playlist.title = patch.title;
    if (patch.emoji === null) delete playlist.emoji;
    else if (patch.emoji !== undefined) playlist.emoji = patch.emoji;
    await this.commit();
  }

  async deletePlaylist(id: string): Promise<void> {
    this.playlist(id);
    this.data.playlists = this.data.playlists.filter((p) => p.id !== id);
    await this.commit();
  }

  async addToPlaylist(id: string, itemIds: readonly string[]): Promise<PlaylistAddResult> {
    const playlist = this.playlist(id);
    const result = addIds(
      playlist.itemIds,
      itemIds.filter((itemId) => this.get(itemId) !== undefined),
    );
    playlist.itemIds = result.itemIds;
    if (result.added > 0) await this.commit();
    return { added: result.added, already: result.already };
  }

  async removeFromPlaylist(id: string, itemIds: readonly string[]): Promise<void> {
    const playlist = this.playlist(id);
    playlist.itemIds = removeIds(playlist.itemIds, itemIds);
    await this.commit();
  }

  async movePlaylistItems(id: string, itemIds: readonly string[], beforeId: string | null): Promise<void> {
    const playlist = this.playlist(id);
    playlist.itemIds = moveIds(playlist.itemIds, itemIds, beforeId);
    await this.commit();
  }

  private playlist(id: string): Playlist {
    const playlist = this.data.playlists.find((p) => p.id === id);
    if (!playlist) throw new Error('playlist not found');
    return playlist;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  flush(): Promise<void> {
    return this.file.idle();
  }

  private async commit(): Promise<void> {
    await this.file.write(this.data);
    for (const listener of this.listeners) listener();
  }
}
