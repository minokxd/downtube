import { chaptersFromYtdlp } from '@shared/chapters';
import type { Chapter } from '@shared/types';
import { DONE_PREFIX, PP_PREFIX, PROGRESS_PREFIX } from './args';

export interface DoneInfo {
  id: string;
  title: string;
  channel?: string;
  channelId?: string;
  artist?: string;
  track?: string;
  durationSec?: number;
  /** Only present when the video has chapters. */
  chapters?: Chapter[];
  filepath: string;
}

export type YtdlpEvent =
  | {
      type: 'progress';
      status: 'downloading' | 'finished' | 'error';
      downloadedBytes?: number;
      totalBytes?: number;
      speedBps?: number;
      etaSec?: number;
      formatId?: string;
    }
  | { type: 'postprocess'; name: string; status: string }
  | { type: 'done'; info: DoneInfo }
  | { type: 'log'; line: string };

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === 'NA' || trimmed === 'None') return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

export function toDoneInfo(raw: unknown): DoneInfo | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = text(r.id);
  const filepath = text(r.filepath);
  if (!id || !filepath) return null;
  const info: DoneInfo = {
    id,
    title: text(r.title) ?? id,
    channel: text(r.channel) ?? text(r.uploader),
    channelId: text(r.channel_id),
    artist: text(r.artist),
    track: text(r.track),
    durationSec: typeof r.duration === 'number' && Number.isFinite(r.duration) ? r.duration : undefined,
    filepath,
  };
  const chapters = chaptersFromYtdlp(r.chapters);
  if (chapters.length > 0) info.chapters = chapters;
  return info;
}

export function parseLine(line: string): YtdlpEvent {
  if (line.startsWith(PROGRESS_PREFIX)) {
    const [status, downloaded, total, estimate, speed, eta, formatId] = line.slice(PROGRESS_PREFIX.length).split('|');
    const fid = formatId?.trim();
    return {
      type: 'progress',
      status: status === 'finished' || status === 'error' ? status : 'downloading',
      downloadedBytes: toNumber(downloaded),
      totalBytes: toNumber(total) ?? toNumber(estimate),
      speedBps: toNumber(speed),
      etaSec: toNumber(eta),
      formatId: fid && fid !== 'NA' ? fid : undefined,
    };
  }
  if (line.startsWith(PP_PREFIX)) {
    const [name, status] = line.slice(PP_PREFIX.length).split('|');
    return { type: 'postprocess', name: (name ?? '').trim(), status: (status ?? '').trim() };
  }
  if (line.startsWith(DONE_PREFIX)) {
    try {
      const info = toDoneInfo(JSON.parse(line.slice(DONE_PREFIX.length)) as unknown);
      if (info) return { type: 'done', info };
    } catch {
      // not valid JSON; reported as a plain log line below
    }
  }
  return { type: 'log', line };
}

export class LineSplitter {
  private buffer = '';

  constructor(private readonly onLine: (line: string) => void) {}

  push(chunk: string): void {
    this.buffer += chunk;
    const parts = this.buffer.split(/\r\n|\n|\r/);
    this.buffer = parts.pop() ?? '';
    for (const part of parts) if (part.length > 0) this.onLine(part);
  }

  flush(): void {
    if (this.buffer.length > 0) this.onLine(this.buffer);
    this.buffer = '';
  }
}
