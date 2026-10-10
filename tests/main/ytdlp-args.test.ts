import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DONE_PREFIX,
  OUTPUT_TEMPLATE,
  PP_PREFIX,
  PROGRESS_PREFIX,
  baseArgs,
  buildDownloadArgs,
  buildProbeArgs,
  formatSortFor,
  outputDirFor,
  type DownloadArgsInput,
  type EnginePaths,
} from '../../src/main/ytdlp/args';

const engine: EnginePaths = { ytdlp: 'C:\\bin\\yt-dlp.exe', deno: 'C:\\bin\\deno.exe', ffmpegDir: 'C:\\ffmpeg\\bin' };
const URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

const input = (overrides: Partial<DownloadArgsInput> = {}): DownloadArgsInput => ({
  url: URL,
  kind: 'video',
  quality: '1080',
  subtitles: false,
  subtitleLangs: ['tr', 'en'],
  includeAutoSubs: false,
  outputDir: 'D:\\Downtube\\Video',
  ...overrides,
});

const valueAfter = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};

const valuesAfter = (args: string[], flag: string): string[] =>
  args.flatMap((arg, i) => (arg === flag && args[i + 1] !== undefined ? [args[i + 1] as string] : []));

describe('baseArgs', () => {
  it('ignores user config and wires deno and ffmpeg', () => {
    expect(baseArgs(engine)).toEqual([
      '--ignore-config',
      '--js-runtimes',
      'deno:C:\\bin\\deno.exe',
      '--ffmpeg-location',
      'C:\\ffmpeg\\bin',
      '--color',
      'never',
    ]);
  });
});

describe('buildDownloadArgs', () => {
  it('starts with engine options and ends with the url after --', () => {
    const args = buildDownloadArgs(engine, input());
    expect(args.slice(0, baseArgs(engine).length)).toEqual(baseArgs(engine));
    expect(args.slice(-2)).toEqual(['--', URL]);
  });

  it('caps video resolution, prefers h264/aac and outputs mp4', () => {
    const args = buildDownloadArgs(engine, input({ quality: '1080' }));
    expect(valueAfter(args, '-S')).toBe('res:1080,vcodec:h264,acodec:aac');
    expect(valueAfter(args, '--merge-output-format')).toBe('mp4');
    expect(valueAfter(args, '--remux-video')).toBe('mp4');
    expect(args).not.toContain('-x');
  });

  it('has no resolution cap for best quality', () => {
    expect(valueAfter(buildDownloadArgs(engine, input({ quality: 'best' })), '-S')).toBe('res,vcodec:h264,acodec:aac');
  });

  it('adds vtt subtitles for the chosen languages', () => {
    const args = buildDownloadArgs(engine, input({ subtitles: true }));
    expect(args).toContain('--write-subs');
    expect(valueAfter(args, '--sub-langs')).toBe('tr.*,en.*');
    expect(valueAfter(args, '--convert-subs')).toBe('vtt');
    expect(args).not.toContain('--write-auto-subs');
    expect(buildDownloadArgs(engine, input({ subtitles: true, includeAutoSubs: true }))).toContain('--write-auto-subs');
  });

  it('skips subtitles when no language is chosen', () => {
    expect(buildDownloadArgs(engine, input({ subtitles: true, subtitleLangs: [] }))).not.toContain('--write-subs');
  });

  it('turns audio downloads into mp3 with cover and tags, never subtitles', () => {
    const args = buildDownloadArgs(engine, input({ kind: 'audio', subtitles: true }));
    expect(valueAfter(args, '-f')).toBe('ba/b');
    expect(args).toContain('-x');
    expect(valueAfter(args, '--audio-format')).toBe('mp3');
    expect(valueAfter(args, '--audio-quality')).toBe('0');
    expect(args).toContain('--embed-thumbnail');
    expect(args).toContain('--embed-metadata');
    expect(args).not.toContain('--write-subs');
    expect(args).not.toContain('-S');
  });

  it('embeds chapters in videos and music and reports them when done', () => {
    for (const kind of ['video', 'audio'] as const) {
      const args = buildDownloadArgs(engine, input({ kind }));
      expect(args).toContain('--embed-chapters');
      expect(valueAfter(args, '--print')).toContain('chapters');
    }
  });

  it('prints machine readable progress and the final file', () => {
    const args = buildDownloadArgs(engine, input());
    expect(args).toContain('--newline');
    expect(args).toContain('--progress');
    expect(args).toContain('--no-playlist');
    const templates = valuesAfter(args, '--progress-template');
    expect(templates[0]?.startsWith(`download:${PROGRESS_PREFIX}`)).toBe(true);
    expect(templates[1]?.startsWith(`postprocess:${PP_PREFIX}`)).toBe(true);
    expect(valueAfter(args, '--print')?.startsWith(`after_move:${DONE_PREFIX}`)).toBe(true);
  });

  it('writes a jpg thumbnail into the output folder with id-tagged names', () => {
    const args = buildDownloadArgs(engine, input());
    expect(args).toContain('--write-thumbnail');
    expect(valueAfter(args, '--convert-thumbnails')).toBe('jpg');
    expect(valueAfter(args, '-P')).toBe('D:\\Downtube\\Video');
    expect(valueAfter(args, '-o')).toBe(OUTPUT_TEMPLATE);
    expect(OUTPUT_TEMPLATE).toContain('[%(id)s]');
  });
});

describe('buildProbeArgs', () => {
  it('fully extracts a single video', () => {
    const args = buildProbeArgs(engine, { url: URL, list: false });
    expect(args).toContain('-J');
    expect(args).toContain('--no-playlist');
    expect(args).not.toContain('--flat-playlist');
    expect(args.slice(-2)).toEqual(['--', URL]);
  });

  it("sorts a single video's formats the way a best-quality download picks them", () => {
    const args = buildProbeArgs(engine, { url: URL, list: false });
    expect(valueAfter(args, '-S')).toBe(formatSortFor('best'));
  });

  it('flat-extracts one page of a list', () => {
    const args = buildProbeArgs(engine, { url: 'https://www.youtube.com/@jawed/videos', list: true, start: 101, end: 200 });
    expect(args).toContain('--flat-playlist');
    expect(valueAfter(args, '-I')).toBe('101:200');
    expect(args).not.toContain('-S');
  });
});

describe('outputDirFor', () => {
  it('separates videos and music', () => {
    expect(outputDirFor('D:\\Downtube', 'video')).toBe(join('D:\\Downtube', 'Video'));
    expect(outputDirFor('D:\\Downtube', 'audio')).toBe(join('D:\\Downtube', 'Müzik'));
  });
});
