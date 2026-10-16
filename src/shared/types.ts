import type { Language } from './languages';
import type { SpotifyKind } from './spotify-url';

export type MediaKind = 'video' | 'audio';
export type Quality = 'best' | '1080' | '720' | '480';
export const QUALITIES: readonly Quality[] = ['best', '1080', '720', '480'];

export type ThemeSetting = 'system' | 'dark' | 'light';
export type { Language, SpotifyKind };

export type ErrorCode =
  | 'INVALID_URL'
  | 'PRIVATE'
  | 'AGE_RESTRICTED'
  | 'UNAVAILABLE'
  | 'GEO_BLOCKED'
  | 'BOT_CHECK'
  | 'NETWORK'
  | 'DISK_FULL'
  | 'ENGINE_MISSING'
  | 'NO_MATCH'
  | 'UNKNOWN';

export interface SubtitleTrack {
  lang: string;
  label: string;
  path: string;
}

/** A section the uploader marked in the video, with times in seconds. */
export interface Chapter {
  startSec: number;
  endSec: number;
  title: string;
}

export interface PlaybackProgress {
  positionSec: number;
  updatedAt: string;
  completed: boolean;
}

/** A Spotify song. Its audio comes from the matching recording on YouTube; the tags come from Spotify. */
export interface SpotifyTrack {
  id: string;
  title: string;
  /** All artists, comma separated, as Spotify shows them. */
  artist: string;
  album?: string;
  albumArtist?: string;
  durationSec?: number;
  coverUrl?: string;
  trackNumber?: number;
}

export interface LibraryItem {
  id: string;
  videoId: string;
  kind: MediaKind;
  title: string;
  channel: string;
  channelId?: string;
  artist?: string;
  durationSec: number;
  filePath: string;
  thumbPath?: string;
  subtitles: SubtitleTrack[];
  /** Present only when the video has at least two chapters. */
  chapters?: Chapter[];
  sizeBytes: number;
  addedAt: string;
  sourceUrl: string;
  collectionIds: string[];
  progress: PlaybackProgress;
  playCount: number;
  missing?: boolean;
  /** Set when the item was downloaded from a Spotify link. */
  spotify?: SpotifyTrack;
}

export type CollectionKind = 'playlist' | 'channel' | 'album';

export interface Collection {
  id: string;
  /** The YouTube playlist or channel id, or `spotify-<id>` for a Spotify playlist or album. */
  youtubeId: string;
  kind: CollectionKind;
  title: string;
  thumbPath?: string;
  itemIds: string[];
  positions: Record<string, number>;
  createdAt: string;
}

export interface LibrarySnapshot {
  items: LibraryItem[];
  collections: Collection[];
  playlists: Playlist[];
}

export interface Playlist {
  id: string;
  title: string;
  emoji?: string;
  /** Playlist order; no repeats. */
  itemIds: string[];
  createdAt: string;
}

export interface PlaylistAddResult {
  added: number;
  already: number;
}

/** `emoji: null` removes the emoji. */
export interface PlaylistPatch {
  title?: string;
  emoji?: string | null;
}

export type JobStatus = 'queued' | 'downloading' | 'processing' | 'paused' | 'done' | 'failed' | 'canceled';
export type JobStage = 'match' | 'download' | 'merge' | 'convert' | 'thumbnail' | 'subtitles';

export interface JobProgress {
  percent: number;
  downloadedBytes: number;
  totalBytes?: number;
  speedBps?: number;
  etaSec?: number;
  stage: JobStage;
}

export interface JobCollectionRef {
  youtubeId: string;
  kind: CollectionKind;
  title: string;
  index: number;
}

export interface NewJobInput {
  url: string;
  /** Empty for a Spotify song until its YouTube match is found; `url` is then the Spotify link. */
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  kind: MediaKind;
  quality: Quality;
  subtitles: boolean;
  collection?: JobCollectionRef;
  spotify?: SpotifyTrack;
}

export interface Job extends NewJobInput {
  id: string;
  status: JobStatus;
  progress: JobProgress;
  error?: { code: ErrorCode; log: string };
  createdAt: string;
  libraryItemId?: string;
}

export interface AddJobsResult {
  added: number;
  skipped: { videoId: string; reason: 'in-library' | 'in-queue' }[];
}

export interface ProbeEntry {
  videoId: string;
  url: string;
  title: string;
  durationSec?: number;
  thumbnailUrl?: string;
  channel?: string;
}

export interface ProbeVideo extends ProbeEntry {
  channel: string;
  heights: number[];
  hasSubtitles: boolean;
  /** Bytes a video download would fetch per quality; a quality is missing when YouTube gave no size. */
  sizes?: Partial<Record<Quality, number>>;
  listId?: string;
}

export interface ProbeList {
  listKind: CollectionKind;
  youtubeId: string;
  title: string;
  channel?: string;
  totalCount?: number;
  entries: ProbeEntry[];
  hasMore: boolean;
  nextStart: number;
  sourceUrl: string;
}

export interface SpotifyList {
  kind: SpotifyKind;
  id: string;
  title: string;
  /** The artist of an album or song, or the owner of a playlist. */
  owner?: string;
  coverUrl?: string;
  totalCount?: number;
  tracks: SpotifyTrack[];
  hasMore: boolean;
  nextStart: number;
  /** Spotify only shared the first page of a longer playlist. */
  partial?: boolean;
  sourceUrl: string;
}

export type ProbeResult =
  | { type: 'video'; video: ProbeVideo }
  | { type: 'list'; list: ProbeList }
  | { type: 'spotify'; list: SpotifyList };
export type ProbeResponse = { ok: true; result: ProbeResult } | { ok: false; code: ErrorCode; log?: string };

export interface SubtitleSettings {
  enabled: boolean;
  langs: string[];
  includeAuto: boolean;
}

export interface Settings {
  theme: ThemeSetting;
  language: Language;
  downloadDir: string;
  defaultQuality: Quality;
  concurrency: number;
  subtitles: SubtitleSettings;
  clipboardWatch: boolean;
  lastYtdlpUpdateCheck?: string;
}

export type EngineComponentId = 'ytdlp' | 'deno' | 'ffmpeg';

export interface EngineComponentStatus {
  id: EngineComponentId;
  installed: boolean;
  source: 'bundled' | 'system' | 'missing';
  version?: string;
  path?: string;
}

export interface EngineStatus {
  ready: boolean;
  components: EngineComponentStatus[];
}

export type InstallPhase = 'download' | 'verify' | 'extract' | 'done' | 'error';

export interface EngineInstallProgress {
  component: EngineComponentId;
  phase: InstallPhase;
  receivedBytes: number;
  totalBytes?: number;
  error?: string;
}

export interface UpdateResult {
  ok: boolean;
  version?: string;
  message?: string;
}
