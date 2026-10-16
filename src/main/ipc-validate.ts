import { isPlaylistEmoji } from '@shared/playlist-emojis';
import { cleanPlaylistTitle } from '@shared/playlist-ops';
import { cleanSpotifyTrack } from '@shared/spotify-track';
import { isSupportedLink, spotifyUrl } from '@shared/spotify-url';
import { QUALITIES, type NewJobInput, type PlaylistPatch, type Quality, type Settings } from '@shared/types';
import { VIDEO_ID_RE, classifyUrl } from '@shared/youtube-url';

export class IpcValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IpcValidationError';
  }
}

const fail = (message: string): never => {
  throw new IpcValidationError(message);
};

export function assertId(value: unknown): string {
  return typeof value === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(value) ? value : fail('invalid id');
}

export function assertYoutubeUrl(value: unknown): string {
  return typeof value === 'string' && value.length <= 2048 && classifyUrl(value).kind !== 'invalid' ? value : fail('invalid YouTube URL');
}

/** A YouTube or Spotify link. */
export function assertLink(value: unknown): string {
  return typeof value === 'string' && value.length <= 2048 && isSupportedLink(value) ? value : fail('invalid link');
}

export function assertStart(value: unknown): number {
  if (value === undefined) return 1;
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100_000 ? value : fail('invalid start');
}

export function assertPosition(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10_000_000 ? value : fail('invalid position');
}

export function assertOptionalDuration(value: unknown): number | undefined {
  return value === undefined ? undefined : assertPosition(value);
}

export function assertBoolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : fail('invalid boolean');
}

export function assertTheme(value: unknown): 'dark' | 'light' {
  return value === 'dark' || value === 'light' ? value : fail('invalid theme');
}

// The renderer never sends file paths or the update timestamp: the download folder is only
// set through the native folder dialog in the main process, and the timestamp only by the updater.
const MAIN_ONLY_SETTINGS = ['downloadDir', 'lastYtdlpUpdateCheck'];

// Field-level validation stays in SettingsStore.
export function assertSettingsPatch(value: unknown): Partial<Settings> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return fail('invalid settings patch');
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return fail('invalid settings patch');
  if (MAIN_ONLY_SETTINGS.some((key) => Object.hasOwn(value, key))) return fail('setting cannot be changed from the renderer');
  return value as Partial<Settings>;
}

const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;

function assertJobInput(value: unknown): NewJobInput {
  if (typeof value !== 'object' || value === null) return fail('invalid job');
  const v = value as Record<string, unknown>;
  const spotify = v.spotify === undefined ? undefined : (cleanSpotifyTrack(v.spotify) ?? fail('invalid Spotify song'));
  let videoId: string;
  let url: string;
  if (spotify && v.videoId === '') {
    // A Spotify song not matched yet: its Spotify link stands in for the watch URL until the queue finds the video.
    videoId = '';
    url = v.url === spotifyUrl('track', spotify.id) ? v.url : fail('url does not match the Spotify song');
  } else {
    videoId = typeof v.videoId === 'string' && VIDEO_ID_RE.test(v.videoId) ? v.videoId : fail('invalid video id');
    // A job is exactly one video: a playlist or channel URL would download everything, and the
    // library/queue bookkeeping is keyed by videoId. The canonical watch URL is what gets stored.
    const info = classifyUrl(assertYoutubeUrl(v.url));
    url = info.kind === 'video' && info.videoId === videoId ? info.url : fail('url does not match video id');
  }
  const title = isText(v.title, 500) ? v.title.trim() || videoId || (spotify?.title ?? '') : fail('invalid title');
  const kind = v.kind === 'video' || v.kind === 'audio' ? v.kind : fail('invalid kind');
  if (spotify && kind !== 'audio') return fail('Spotify songs download as music');
  const quality = QUALITIES.includes(v.quality as Quality) ? (v.quality as Quality) : fail('invalid quality');
  const subtitles = assertBoolean(v.subtitles);
  const job: NewJobInput = { url, videoId, title, kind, quality, subtitles };
  if (spotify) job.spotify = spotify;
  if (v.thumbnailUrl !== undefined) {
    const thumb = v.thumbnailUrl;
    job.thumbnailUrl = isText(thumb, 2048) && thumb.startsWith('https://') ? thumb : fail('invalid thumbnail');
  }
  if (v.collection !== undefined) {
    if (typeof v.collection !== 'object' || v.collection === null) return fail('invalid collection');
    const c = v.collection as Record<string, unknown>;
    job.collection = {
      youtubeId: typeof c.youtubeId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(c.youtubeId) ? c.youtubeId : fail('invalid collection id'),
      kind: c.kind === 'playlist' || c.kind === 'channel' || c.kind === 'album' ? c.kind : fail('invalid collection kind'),
      title: isText(c.title, 500) ? c.title : fail('invalid collection title'),
      index: typeof c.index === 'number' && Number.isInteger(c.index) && c.index >= 0 ? c.index : fail('invalid collection index'),
    };
  }
  return job;
}

export function assertJobInputs(value: unknown): NewJobInput[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 500) return fail('invalid job list');
  return value.map(assertJobInput);
}

export function assertPlaylistTitle(value: unknown): string {
  return cleanPlaylistTitle(value) ?? fail('invalid playlist title');
}

export function assertPlaylistEmoji(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return isPlaylistEmoji(value) ? value : fail('invalid playlist emoji');
}

export function assertPlaylistPatch(value: unknown): PlaylistPatch {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return fail('invalid playlist patch');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((key) => key !== 'title' && key !== 'emoji')) return fail('invalid playlist patch');
  const patch: PlaylistPatch = {};
  if (v.title !== undefined) patch.title = assertPlaylistTitle(v.title);
  if (v.emoji === null) patch.emoji = null;
  else if (v.emoji !== undefined) patch.emoji = assertPlaylistEmoji(v.emoji);
  return patch;
}

export function assertIdList(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 5000) return fail('invalid id list');
  return [...new Set(value.map(assertId))];
}

export function assertOptionalId(value: unknown): string | null {
  return value === null ? null : assertId(value);
}
