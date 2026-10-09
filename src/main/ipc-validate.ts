import { QUALITIES, type NewJobInput, type Quality } from '@shared/types';
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

const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;

function assertJobInput(value: unknown): NewJobInput {
  if (typeof value !== 'object' || value === null) return fail('invalid job');
  const v = value as Record<string, unknown>;
  const url = assertYoutubeUrl(v.url);
  const videoId = typeof v.videoId === 'string' && VIDEO_ID_RE.test(v.videoId) ? v.videoId : fail('invalid video id');
  const title = isText(v.title, 500) ? v.title.trim() || videoId : fail('invalid title');
  const kind = v.kind === 'video' || v.kind === 'audio' ? v.kind : fail('invalid kind');
  const quality = QUALITIES.includes(v.quality as Quality) ? (v.quality as Quality) : fail('invalid quality');
  const subtitles = assertBoolean(v.subtitles);
  const job: NewJobInput = { url, videoId, title, kind, quality, subtitles };
  if (v.thumbnailUrl !== undefined) {
    const thumb = v.thumbnailUrl;
    job.thumbnailUrl = isText(thumb, 2048) && thumb.startsWith('https://') ? thumb : fail('invalid thumbnail');
  }
  if (v.collection !== undefined) {
    if (typeof v.collection !== 'object' || v.collection === null) return fail('invalid collection');
    const c = v.collection as Record<string, unknown>;
    job.collection = {
      youtubeId: typeof c.youtubeId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(c.youtubeId) ? c.youtubeId : fail('invalid collection id'),
      kind: c.kind === 'playlist' || c.kind === 'channel' ? c.kind : fail('invalid collection kind'),
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
