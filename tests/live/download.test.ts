import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Engine } from '../../src/main/engine/engine';
import { findSidecars } from '../../src/main/library/sidecars';
import { outputDirFor } from '../../src/main/ytdlp/args';
import { YtdlpClient } from '../../src/main/ytdlp/client';
import type { DoneInfo } from '../../src/main/ytdlp/output';
import { ProgressTracker } from '../../src/main/ytdlp/progress';

// Real network test against YouTube's first video (19 seconds). Run with `npm run test:live`.
const URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
const BIN = resolve('tests/.tmp/live-bin');

let client: YtdlpClient;
let out: string;

beforeAll(async () => {
  const engine = new Engine({ binDir: BIN, fetchImpl: (url, init) => fetch(url, init) });
  const status = await engine.status();
  if (!status.ready) await engine.install(() => undefined);
  expect((await engine.status()).ready).toBe(true);
  client = new YtdlpClient({ getPaths: () => engine.paths() });
  out = await mkdtemp(join(tmpdir(), 'downtube-live-'));
});

afterAll(async () => {
  if (out) await rm(out, { recursive: true, force: true });
});

describe('live yt-dlp', () => {
  it('probes the video', async () => {
    const result = await client.probe('https://youtu.be/jNQXAC9IVRw');
    expect(result.type).toBe('video');
    if (result.type !== 'video') return;
    expect(result.video.title).toBe('Me at the zoo');
    expect(result.video.durationSec).toBe(19);
  });

  it('probes the channel', async () => {
    const result = await client.probe('https://www.youtube.com/@jawed');
    expect(result.type === 'list' && result.list.entries.some((e) => e.videoId === 'jNQXAC9IVRw')).toBe(true);
  });

  it.each(['video', 'audio'] as const)('downloads it as %s', async (kind) => {
    const tracker = new ProgressTracker(kind);
    let done: DoneInfo | undefined;
    let percent = 0;
    const handle = client.download(
      { url: URL, kind, quality: '1080', subtitles: true, subtitleLangs: ['en'], includeAutoSubs: false, outputDir: outputDirFor(out, kind) },
      (event) => {
        if (event.type === 'done') done = event.info;
        const progress = tracker.apply(event);
        if (progress) percent = progress.percent;
      },
    );
    const result = await handle.done;
    expect(result.code, result.log).toBe(0);
    expect(done).toBeDefined();
    expect(done!.filepath.endsWith(kind === 'video' ? '.mp4' : '.mp3')).toBe(true);
    expect((await stat(done!.filepath)).size).toBeGreaterThan(10_000);
    const sidecars = await findSidecars(done!.filepath);
    expect(sidecars.thumbPath).toBeDefined();
    if (kind === 'video') expect(sidecars.subtitles.map((s) => s.lang)).toContain('en');
    expect(percent).toBeGreaterThanOrEqual(90);
  });
});
