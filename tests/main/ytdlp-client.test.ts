import { describe, expect, it } from 'vitest';
import type { EnginePaths } from '../../src/main/ytdlp/args';
import { YtdlpClient } from '../../src/main/ytdlp/client';
import { YtdlpError } from '../../src/main/ytdlp/errors';
import type { YtdlpEvent } from '../../src/main/ytdlp/output';
import type { RunFn, RunResult } from '../../src/main/ytdlp/process';

const paths: EnginePaths = { ytdlp: 'C:\\bin\\yt-dlp.exe', deno: 'C:\\bin\\deno.exe', ffmpegDir: 'C:\\ffmpeg' };

function fakeRun(result: Partial<RunResult>, lines: string[] = []) {
  const calls: string[][] = [];
  const run: RunFn = (_exe, args, options) => {
    calls.push(args);
    for (const line of lines) options?.onLine?.(line, 'stdout');
    return {
      done: Promise.resolve({ code: 0, canceled: false, stdout: '', log: '', ...result }),
      cancel: () => undefined,
    };
  };
  return { run, calls };
}

const videoStdout = JSON.stringify({ id: 'jNQXAC9IVRw', title: 'Me at the zoo', uploader: 'jawed', duration: 19, formats: [] });

describe('YtdlpClient.probe', () => {
  it('probes a single video without the playlist', async () => {
    const { run, calls } = fakeRun({ stdout: videoStdout });
    const result = await new YtdlpClient({ getPaths: () => paths, run }).probe('https://youtu.be/jNQXAC9IVRw');
    expect(result.type).toBe('video');
    expect(result.type === 'video' && result.video.title).toBe('Me at the zoo');
    expect(calls[0]).toContain('--no-playlist');
    expect(calls[0]?.at(-1)).toBe('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  });

  it('probes channels page by page', async () => {
    const { run, calls } = fakeRun({ stdout: JSON.stringify({ id: 'UC1', title: 'x - Videos', channel: 'x', entries: [] }) });
    const client = new YtdlpClient({ getPaths: () => paths, run });
    const first = await client.probe('https://www.youtube.com/@x');
    await client.probe('https://www.youtube.com/@x', 101);
    expect(first.type === 'list' && first.list.listKind).toBe('channel');
    expect(calls[0]).toEqual(expect.arrayContaining(['--flat-playlist', '-I', '1:100']));
    expect(calls[1]).toEqual(expect.arrayContaining(['-I', '101:200']));
    expect(calls[0]?.at(-1)).toBe('https://www.youtube.com/@x/videos');
  });

  it('maps yt-dlp failures to error codes', async () => {
    const { run } = fakeRun({ code: 1, log: 'ERROR: [youtube] abc: Private video' });
    await expect(new YtdlpClient({ getPaths: () => paths, run }).probe('https://youtu.be/jNQXAC9IVRw')).rejects.toMatchObject({
      code: 'PRIVATE',
    });
  });

  it('treats a process that could not be spawned as a missing engine, not a mapped error', async () => {
    // The log text would map to NETWORK; a spawn failure must win over it.
    const { run } = fakeRun({ code: null, log: 'spawn error: EBUSY (unable to download webpage)' });
    await expect(new YtdlpClient({ getPaths: () => paths, run }).probe('https://youtu.be/jNQXAC9IVRw')).rejects.toMatchObject({
      code: 'ENGINE_MISSING',
      log: 'spawn error: EBUSY (unable to download webpage)',
    });
  });

  it('rejects invalid links and a missing engine', async () => {
    const { run } = fakeRun({});
    const client = new YtdlpClient({ getPaths: () => paths, run });
    await expect(client.probe('https://vimeo.com/1')).rejects.toBeInstanceOf(YtdlpError);
    await expect(client.probe('https://vimeo.com/1')).rejects.toMatchObject({ code: 'INVALID_URL' });
    await expect(new YtdlpClient({ getPaths: () => null, run }).probe('https://youtu.be/jNQXAC9IVRw')).rejects.toMatchObject({
      code: 'ENGINE_MISSING',
    });
  });
});

describe('YtdlpClient.download', () => {
  it('turns output lines into events', async () => {
    const { run, calls } = fakeRun({}, ['DT_PP Merger|started', '[download] hello']);
    const events: YtdlpEvent[] = [];
    const handle = new YtdlpClient({ getPaths: () => paths, run }).download(
      {
        url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
        kind: 'audio',
        quality: 'best',
        subtitles: false,
        subtitleLangs: [],
        includeAutoSubs: false,
        outputDir: 'D:\\Music',
      },
      (event) => events.push(event),
    );
    await handle.done;
    expect(events).toEqual([
      { type: 'postprocess', name: 'Merger', status: 'started' },
      { type: 'log', line: '[download] hello' },
    ]);
    expect(calls[0]).toContain('--audio-format');
  });
});
