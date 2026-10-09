import type { JobProgress, JobStage, MediaKind } from '@shared/types';
import type { YtdlpEvent } from './output';

const STAGE_BY_POSTPROCESSOR: Record<string, JobStage> = {
  Merger: 'merge',
  VideoRemuxer: 'merge',
  VideoConvertor: 'merge',
  FixupM3u8: 'merge',
  FixupM4a: 'merge',
  FixupDuplicateMoov: 'merge',
  FixupStretched: 'merge',
  FixupTimestamp: 'merge',
  ExtractAudio: 'convert',
  ThumbnailsConvertor: 'thumbnail',
  EmbedThumbnail: 'thumbnail',
  SubtitlesConvertor: 'subtitles',
  FFmpegEmbedSubtitle: 'subtitles',
};

// yt-dlp downloads video and audio as separate files. Each file gets a slice of
// one overall bar so the bar never jumps backwards.
const RANGES: Record<MediaKind, Array<[number, number]>> = {
  video: [
    [0, 90],
    [90, 99],
  ],
  audio: [
    [0, 95],
    [95, 99],
  ],
};

export function initialProgress(): JobProgress {
  return { percent: 0, downloadedBytes: 0, stage: 'download' };
}

export class ProgressTracker {
  private formatIndex = -1;
  private currentFormat: string | undefined;
  private snapshot: JobProgress = initialProgress();

  constructor(private readonly kind: MediaKind) {}

  get progress(): JobProgress {
    return { ...this.snapshot };
  }

  apply(event: YtdlpEvent): JobProgress | null {
    if (event.type === 'progress') {
      // Subtitle and thumbnail downloads report no format id.
      if (!event.formatId) return null;
      if (event.formatId !== this.currentFormat) {
        this.currentFormat = event.formatId;
        this.formatIndex += 1;
      }
      const ranges = RANGES[this.kind];
      const [low, high] = ranges[Math.min(this.formatIndex, ranges.length - 1)] as [number, number];
      const done = event.downloadedBytes ?? 0;
      const total = event.totalBytes;
      const fraction = total && total > 0 ? Math.min(1, done / total) : event.status === 'finished' ? 1 : 0;
      const percent = Math.max(this.snapshot.percent, Math.round((low + (high - low) * fraction) * 10) / 10);
      const finished = event.status === 'finished';
      this.snapshot = {
        percent,
        downloadedBytes: done,
        totalBytes: total,
        speedBps: finished ? undefined : event.speedBps,
        etaSec: finished ? undefined : event.etaSec,
        stage: 'download',
      };
      return this.progress;
    }
    if (event.type === 'postprocess' && event.status === 'started') {
      const stage = STAGE_BY_POSTPROCESSOR[event.name];
      if (!stage || stage === this.snapshot.stage) return null;
      this.snapshot = { ...this.snapshot, stage, speedBps: undefined, etaSec: undefined };
      return this.progress;
    }
    return null;
  }
}
