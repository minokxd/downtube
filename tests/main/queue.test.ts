import { describe, expect, it, vi } from 'vitest';
import type { Job, NewJobInput } from '@shared/types';
import { DownloadQueue, restoreJobs, sanitizeJobs, type QueueDeps } from '../../src/main/queue/queue';
import type { YtdlpEvent } from '../../src/main/ytdlp/output';
import type { RunResult } from '../../src/main/ytdlp/process';

interface FakeRun {
  job: Job;
  emit: (event: YtdlpEvent) => void;
  finish: (result: Partial<RunResult>) => void;
}

function setup(overrides: Partial<QueueDeps> = {}, initial: Job[] = []) {
  const runs: FakeRun[] = [];
  const deps: QueueDeps = {
    startDownload: (job, onEvent) => {
      let resolve!: (result: RunResult) => void;
      const done = new Promise<RunResult>((r) => (resolve = r));
      runs.push({
        job,
        emit: onEvent,
        finish: (result) => resolve({ code: 0, canceled: false, stdout: '', log: '', ...result }),
      });
      return { done, cancel: () => resolve({ code: null, canceled: true, stdout: '', log: '' }) };
    },
    onCompleted: vi.fn(async () => 'library-item-1'),
    isInLibrary: vi.fn(() => false),
    cleanupPartials: vi.fn(async () => undefined),
    persist: vi.fn(async () => undefined),
    getConcurrency: () => 2,
    canStart: () => true,
    persistDelayMs: 0,
    ...overrides,
  };
  const queue = new DownloadQueue(deps, initial);
  return { queue, runs, deps };
}

const input = (videoId: string, overrides: Partial<NewJobInput> = {}): NewJobInput => ({
  url: `https://www.youtube.com/watch?v=${videoId}`,
  videoId,
  title: `Video ${videoId}`,
  kind: 'video',
  quality: '1080',
  subtitles: false,
  ...overrides,
});

const tick = () => new Promise((r) => setTimeout(r, 0));
const doneInfo = (id: string) => ({ id, title: 'T', filepath: `C:\\${id}.mp4` });

describe('DownloadQueue', () => {
  it('respects the concurrency limit', async () => {
    const { queue, runs } = setup();
    queue.add([input('aaaaaaaaaaa'), input('bbbbbbbbbbb'), input('ccccccccccc')]);
    expect(runs).toHaveLength(2);
    expect(queue.list().map((j) => j.status)).toEqual(['downloading', 'downloading', 'queued']);
    runs[0]?.emit({ type: 'done', info: doneInfo('aaaaaaaaaaa') });
    runs[0]?.finish({ code: 0 });
    await tick();
    expect(runs).toHaveLength(3);
  });

  it('completes a job and records the library item', async () => {
    const { queue, runs, deps } = setup();
    queue.add([input('aaaaaaaaaaa')]);
    runs[0]?.emit({ type: 'progress', status: 'downloading', downloadedBytes: 50, totalBytes: 100, formatId: '137' });
    expect(queue.list()[0]?.progress.percent).toBe(45);
    runs[0]?.emit({ type: 'postprocess', name: 'Merger', status: 'started' });
    expect(queue.list()[0]?.status).toBe('processing');
    runs[0]?.emit({ type: 'done', info: doneInfo('aaaaaaaaaaa') });
    runs[0]?.finish({ code: 0 });
    await tick();
    expect(queue.list()[0]).toMatchObject({ status: 'done', libraryItemId: 'library-item-1', progress: { percent: 100 } });
    expect(deps.onCompleted).toHaveBeenCalledWith(expect.objectContaining({ videoId: 'aaaaaaaaaaa' }), doneInfo('aaaaaaaaaaa'));
  });

  it('maps failures to error codes', async () => {
    const { queue, runs } = setup();
    queue.add([input('aaaaaaaaaaa')]);
    runs[0]?.finish({ code: 1, log: 'ERROR: [youtube] aaaaaaaaaaa: Private video' });
    await tick();
    expect(queue.list()[0]).toMatchObject({ status: 'failed', error: { code: 'PRIVATE' } });
  });

  it('fails when yt-dlp exits cleanly without a file', async () => {
    const { queue, runs } = setup();
    queue.add([input('aaaaaaaaaaa')]);
    runs[0]?.finish({ code: 0 });
    await tick();
    expect(queue.list()[0]).toMatchObject({ status: 'failed', error: { code: 'UNKNOWN' } });
  });

  it('cancels running and queued jobs and cleans up', async () => {
    const { queue, runs, deps } = setup({ getConcurrency: () => 1 });
    queue.add([input('aaaaaaaaaaa'), input('bbbbbbbbbbb')]);
    const [running, waiting] = queue.list();
    queue.cancel(waiting!.id);
    queue.cancel(running!.id);
    await tick();
    expect(queue.list().map((j) => j.status)).toEqual(['canceled', 'canceled']);
    expect(deps.cleanupPartials).toHaveBeenCalledTimes(2);
    expect(runs).toHaveLength(1);
  });

  it('skips videos already in the library or in the queue', () => {
    const { queue } = setup({ isInLibrary: (videoId) => videoId === 'aaaaaaaaaaa' });
    const result = queue.add([input('aaaaaaaaaaa'), input('bbbbbbbbbbb'), input('bbbbbbbbbbb')]);
    expect(result).toEqual({
      added: 1,
      skipped: [
        { videoId: 'aaaaaaaaaaa', reason: 'in-library' },
        { videoId: 'bbbbbbbbbbb', reason: 'in-queue' },
      ],
    });
  });

  it('allows the same video as a different kind', () => {
    const { queue } = setup();
    expect(queue.add([input('aaaaaaaaaaa'), input('aaaaaaaaaaa', { kind: 'audio' })]).added).toBe(2);
  });

  it('resumes paused jobs and retries failed ones from scratch', async () => {
    const restored = restoreJobs([
      {
        ...input('aaaaaaaaaaa'),
        id: 'j1',
        status: 'downloading',
        createdAt: '',
        progress: { percent: 40, downloadedBytes: 1, stage: 'download', speedBps: 5 },
      },
    ]);
    expect(restored[0]).toMatchObject({ status: 'paused', progress: { percent: 40, speedBps: undefined } });
    const { queue, runs } = setup({}, restored);
    queue.pump();
    expect(runs).toHaveLength(0);
    queue.retry('j1');
    expect(runs).toHaveLength(1);
    expect(queue.list()[0]?.progress.percent).toBe(40);
    runs[0]?.finish({ code: 1, log: 'ERROR: Video unavailable' });
    await tick();
    queue.retry('j1');
    expect(queue.list()[0]?.progress.percent).toBe(0);
  });

  it('does not start while blocked and starts after pump', () => {
    let allowed = false;
    const { queue, runs } = setup({ canStart: () => allowed });
    queue.add([input('aaaaaaaaaaa')]);
    expect(runs).toHaveLength(0);
    allowed = true;
    queue.pump();
    expect(runs).toHaveLength(1);
  });

  it('pauses running jobs on shutdown and persists them', async () => {
    const { queue, deps } = setup();
    queue.add([input('aaaaaaaaaaa')]);
    await queue.shutdown();
    expect(queue.list()[0]?.status).toBe('paused');
    expect(deps.cleanupPartials).not.toHaveBeenCalled();
    expect(deps.persist).toHaveBeenLastCalledWith([expect.objectContaining({ status: 'paused' })]);
  });

  it('clears finished jobs and removes single ones', async () => {
    const { queue, runs } = setup();
    queue.add([input('aaaaaaaaaaa'), input('bbbbbbbbbbb')]);
    runs[0]?.emit({ type: 'done', info: doneInfo('aaaaaaaaaaa') });
    runs[0]?.finish({ code: 0 });
    runs[1]?.finish({ code: 1, log: 'ERROR: x' });
    await tick();
    queue.clearFinished();
    expect(queue.list().map((j) => j.status)).toEqual(['failed']);
    queue.remove(queue.list()[0]!.id);
    expect(queue.list()).toEqual([]);
  });

  it('notifies listeners and persists', async () => {
    const { queue, deps } = setup();
    const listener = vi.fn();
    queue.onChange(listener);
    queue.add([input('aaaaaaaaaaa')]);
    expect(listener).toHaveBeenCalled();
    await queue.flush();
    expect(deps.persist).toHaveBeenCalled();
  });
});

describe('sanitizeJobs', () => {
  it('keeps only well-formed jobs', () => {
    const good = {
      ...input('aaaaaaaaaaa'),
      id: 'j',
      status: 'done',
      createdAt: '',
      progress: { percent: 100, downloadedBytes: 0, stage: 'download' },
    };
    expect(sanitizeJobs([good, { id: 1 }, null])).toEqual([good]);
    expect(sanitizeJobs('nope')).toEqual([]);
  });
});
