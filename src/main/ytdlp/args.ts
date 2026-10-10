import { join } from 'node:path';
import type { MediaKind, Quality } from '@shared/types';

export const PROGRESS_PREFIX = 'DT_PROGRESS ';
export const PP_PREFIX = 'DT_PP ';
export const DONE_PREFIX = 'DT_DONE ';
export const OUTPUT_TEMPLATE = '%(title).150B [%(id)s].%(ext)s';

export interface EnginePaths {
  ytdlp: string;
  deno: string;
  ffmpegDir: string;
}

export interface DownloadArgsInput {
  url: string;
  kind: MediaKind;
  quality: Quality;
  subtitles: boolean;
  subtitleLangs: string[];
  includeAutoSubs: boolean;
  outputDir: string;
}

export type ProbeTarget = { url: string; list: false } | { url: string; list: true; start: number; end: number };

const PROGRESS_TEMPLATE =
  `download:${PROGRESS_PREFIX}%(progress.status)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|` +
  '%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s|%(info.format_id)s';
const PP_TEMPLATE = `postprocess:${PP_PREFIX}%(progress.postprocessor)s|%(progress.status)s`;
const DONE_TEMPLATE = `after_move:${DONE_PREFIX}%(.{id,title,channel,channel_id,uploader,artist,track,duration,chapters,filepath})j`;

export function outputDirFor(downloadDir: string, kind: MediaKind): string {
  return join(downloadDir, kind === 'video' ? 'Video' : 'Müzik');
}

export function baseArgs(engine: EnginePaths): string[] {
  return ['--ignore-config', '--js-runtimes', `deno:${engine.deno}`, '--ffmpeg-location', engine.ffmpegDir, '--color', 'never'];
}

export function formatSortFor(quality: Quality): string {
  return quality === 'best' ? 'res,vcodec:h264,acodec:aac' : `res:${quality},vcodec:h264,acodec:aac`;
}

export function buildDownloadArgs(engine: EnginePaths, input: DownloadArgsInput): string[] {
  const args = [
    ...baseArgs(engine),
    '--no-playlist',
    '--newline',
    '--progress',
    '--progress-template',
    PROGRESS_TEMPLATE,
    '--progress-template',
    PP_TEMPLATE,
    '--print',
    DONE_TEMPLATE,
    '--write-thumbnail',
    '--convert-thumbnails',
    'jpg',
    // Chapter markers go into the file itself, so other players show them too.
    '--embed-chapters',
    '--windows-filenames',
    '-P',
    input.outputDir,
    '-o',
    OUTPUT_TEMPLATE,
  ];
  if (input.kind === 'video') {
    args.push('-S', formatSortFor(input.quality), '--merge-output-format', 'mp4', '--remux-video', 'mp4');
    if (input.subtitles && input.subtitleLangs.length > 0) {
      args.push('--write-subs', '--sub-langs', input.subtitleLangs.map((lang) => `${lang}.*`).join(','), '--convert-subs', 'vtt');
      if (input.includeAutoSubs) args.push('--write-auto-subs');
    }
  } else {
    args.push('-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '0', '--embed-thumbnail', '--embed-metadata');
  }
  args.push('--', input.url);
  return args;
}

export function buildProbeArgs(engine: EnginePaths, target: ProbeTarget): string[] {
  const args = [...baseArgs(engine), '-J'];
  if (target.list) args.push('--flat-playlist', '-I', `${target.start}:${target.end}`);
  // The download's sort orders `formats` worst → best, so the probe can tell what each quality would fetch.
  else args.push('--no-playlist', '-S', formatSortFor('best'));
  args.push('--', target.url);
  return args;
}
