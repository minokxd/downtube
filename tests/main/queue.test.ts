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

  it('fails with ENGINE_MISSING when the process could not be spawned', async () => {
    const { queue, runs } = setup();
    queue.add([input('aaaaaaaaaaa')]);
    // The log text would map to NETWORK; a spawn failure must win over it.
    runs[0]?.finish({ code: null, log: 'spawn error: x (unable to download webpage)' });
    await tick();
    expect(queue.list()[0]).toMatchObject({
      status: 'failed',
      error: { code: 'ENGINE_MISSING', log: 'spawn error: x (unable to download webpage)' },
    });
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

  it('attaches an already-owned video to the collection it was skipped for', () => {
    const attachToCollection = vi.fn(async () => true);
    const { queue } = setup({ isInLibrary: (videoId) => videoId === 'aaaaaaaaaaa', attachToCollection });
    const collection = { youtubeId: 'PL1', kind: 'playlist' as const, title: 'Mix', index: 3 };
    const result = queue.add([
      input('aaaaaaaaaaa', { collection }),
      input('bbbbbbbbbbb', { collection: { ...collection, index: 4 } }),
    ]);
    expect(result.skipped).toEqual([{ videoId: 'aaaaaaaaaaa', reason: 'in-library' }]);
    expect(attachToCollection).toHaveBeenCalledTimes(1);
    expect(attachToCollection).toHaveBeenCalledWith('aaaaaaaaaaa', 'video', collection);
  });

  it('does not attach an owned video that has no collection, and survives a failing attach', async () => {
    const attachToCollection = vi.fn(async () => {
      throw new Error('disk');
    });
    const { queue } = setup({ isInLibrary: () => true, attachToCollection });
    const collection = { youtubeId: 'PL1', kind: 'playlist' as const, title: 'Mix', index: 1 };
    expect(() => queue.add([input('aaaaaaaaaaa'), input('bbbbbbbbbbb', { collection })])).not.toThrow();
    await tick();
    expect(attachToCollection).toHaveBeenCalledTimes(1);
    expect(attachToCollection).toHaveBeenCalledWith('bbbbbbbbbbb', 'video', collection);
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

describe('DownloadQueue resilience', () => {
  it('keeps starting and completing jobs when a listener throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { queue, runs } = setup();
      queue.onChange(() => {
        throw new Error('window destroyed');
      });
      queue.add([input('aaaaaaaaaaa'), input('bbbbbbbbbbb')]);
      expect(runs).toHaveLength(2);
      runs[0]?.emit({ type: 'done', info: doneInfo('aaaaaaaaaaa') });
      runs[0]?.finish({ code: 0 });
      await tick();
      expect(queue.list()[0]?.status).toBe('done');
      expect(errorSpy).toHaveBeenCalledWith('[queue] listener failed', expect.any(Error));
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('ignores a retry while the canceled job is still cleaning up', async () => {
    let finishCleanup: () => void = () => undefined;
    const cleanupPartials = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishCleanup = () => resolve();
        }),
    );
    const { queue, runs } = setup({ cleanupPartials, getConcurrency: () => 1 });
    queue.add([input('aaaaaaaaaaa')]);
    const id = queue.list()[0]!.id;
    queue.cancel(id);
    await tick();
    expect(queue.list()[0]?.status).toBe('canceled');
    queue.retry(id);
    expect(queue.list()[0]?.status).toBe('canceled');
    expect(runs).toHaveLength(1);
    finishCleanup();
    await tick();
    queue.retry(id);
    expect(runs).toHaveLength(2);
    expect(queue.list()[0]?.status).toBe('downloading');
    expect(queue.isIdle()).toBe(false);
  });

  it('waits for an in-flight completion on shutdown', async () => {
    let finishCompletion: (libraryItemId: string) => void = () => undefined;
    const onCompleted = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finishCompletion = resolve;
        }),
    );
    const { queue, runs, deps } = setup({ onCompleted });
    queue.add([input('aaaaaaaaaaa')]);
    runs[0]?.emit({ type: 'done', info: doneInfo('aaaaaaaaaaa') });
    runs[0]?.finish({ code: 0 });
    await tick();
    let shutdownFinished = false;
    const shutdown = queue.shutdown().then(() => {
      shutdownFinished = true;
    });
    await tick();
    expect(shutdownFinished).toBe(false);
    finishCompletion('library-item-1');
    await shutdown;
    expect(queue.list()[0]).toMatchObject({ status: 'done', libraryItemId: 'library-item-1' });
    expect(deps.persist).toHaveBeenLastCalledWith([expect.objectContaining({ status: 'done' })]);
  });

  it('stops waiting for a stuck completion after the shutdown timeout', async () => {
    const { queue, runs, deps } = setup({
      onCompleted: vi.fn(() => new Promise<string>(() => undefined)),
      shutdownTimeoutMs: 10,
    });
    queue.add([input('aaaaaaaaaaa')]);
    runs[0]?.emit({ type: 'done', info: doneInfo('aaaaaaaaaaa') });
    runs[0]?.finish({ code: 0 });
    await tick();
    await queue.shutdown();
    expect(queue.list()[0]?.status).toBe('paused');
    expect(deps.persist).toHaveBeenLastCalledWith([expect.objectContaining({ status: 'paused' })]);
  });

  it('keeps the queue alive when persisting fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { queue } = setup({
        persist: vi.fn(async () => {
          throw new Error('EPERM: operation not permitted');
        }),
        persistDelayMs: 0,
      });
      queue.add([input('aaaaaaaaaaa')]);
      await tick();
      await tick();
      await expect(queue.shutdown()).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith('[queue] persist failed', expect.any(Error));
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('keeps the queue alive when partial cleanup fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { queue } = setup({
        getConcurrency: () => 1,
        cleanupPartials: vi.fn(async () => {
          throw new Error('EBUSY');
        }),
      });
      queue.add([input('aaaaaaaaaaa'), input('bbbbbbbbbbb')]);
      const [running, waiting] = queue.list();
      queue.cancel(waiting!.id);
      queue.cancel(running!.id);
      await tick();
      expect(queue.list().map((j) => j.status)).toEqual(['canceled', 'canceled']);
      expect(errorSpy).toHaveBeenCalledWith('[queue] completion failed', expect.any(Error));
    } finally {
      errorSpy.mockRestore();
    }
  });
});
