export type MediaKind = 'video' | 'audio';
export type Quality = 'best' | '1080' | '720' | '480';
export const QUALITIES: readonly Quality[] = ['best', '1080', '720', '480'];

export type ThemeSetting = 'system' | 'dark' | 'light';
export type Language = 'tr' | 'en';

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
  | 'UNKNOWN';

export interface SubtitleTrack {
  lang: string;
  label: string;
  path: string;
}

export interface PlaybackProgress {
  positionSec: number;
  updatedAt: string;
  completed: boolean;
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
  sizeBytes: number;
  addedAt: string;
  sourceUrl: string;
  collectionIds: string[];
  progress: PlaybackProgress;
  playCount: number;
  missing?: boolean;
}

export type CollectionKind = 'playlist' | 'channel';

export interface Collection {
  id: string;
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
export type JobStage = 'download' | 'merge' | 'convert' | 'thumbnail' | 'subtitles';

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
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  kind: MediaKind;
  quality: Quality;
  subtitles: boolean;
  collection?: JobCollectionRef;
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

export type ProbeResult = { type: 'video'; video: ProbeVideo } | { type: 'list'; list: ProbeList };
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
