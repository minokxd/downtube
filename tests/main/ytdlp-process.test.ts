import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chainRuns, failedRun, runProcess, type RunHandle, type RunOptions, type RunResult, type StreamName } from '../../src/main/ytdlp/process';

const FAKE = resolve('tests/fixtures/fake-proc.cjs');
const run = (mode: string, options: RunOptions = {}) => runProcess(process.execPath, [FAKE, mode], options);

describe('runProcess', () => {
  it('streams lines from both outputs, including lines split across chunks', async () => {
    const lines: Array<[string, StreamName]> = [];
    const result = await run('lines', {
      onLine: (line, stream) => lines.push([line, stream]),
      shouldLog: (line) => !line.startsWith('DT_PROGRESS'),
    }).done;
    expect(result.code).toBe(0);
    expect(lines.filter(([, s]) => s === 'stdout').map(([l]) => l)).toEqual([
      'DT_PROGRESS downloading|1|2|NA|NA|NA|137',
      'partial line',
    ]);
    expect(lines.filter(([, s]) => s === 'stderr').map(([l]) => l)).toEqual(['DT_PP Merger|started', 'warning: türkçe çıktı']);
    expect(result.log).not.toContain('DT_PROGRESS');
    expect(result.log).toContain('türkçe');
  });

  it('collects stdout as raw text when asked', async () => {
    const result = await run('json', { collectStdout: true }).done;
    expect(JSON.parse(result.stdout)).toEqual({ title: 'Gülümse', n: 1 });
  });

  it('reports the exit code and keeps stderr in the log', async () => {
    const result = await run('fail').done;
    expect(result.code).toBe(1);
    expect(result.log).toContain('Video unavailable');
  });

  it('passes UTF-8 hints to Python', async () => {
    const lines: string[] = [];
    await run('env', { onLine: (line) => lines.push(line) }).done;
    expect(lines).toEqual(['1|utf-8']);
  });

  it('cancels a running process tree', async () => {
    let started!: () => void;
    const isStarted = new Promise<void>((r) => (started = r));
    const handle = run('hang', {
      onLine: (line) => {
        if (line === 'started') started();
      },
    });
    await isStarted;
    handle.cancel();
    const result = await handle.done;
    expect(result.canceled).toBe(true);
  });

  it('reports a missing executable instead of throwing', async () => {
    const result = await runProcess('C:\\definitely\\missing\\tool.exe', []).done;
    expect(result.code).toBeNull();
    expect(result.log).toContain('spawn error');
  });

  it('turns a synchronous spawn throw into a failed result instead of throwing', async () => {
    // Node throws synchronously (ERR_INVALID_ARG_VALUE) for a NUL byte in an argument,
    // like it does for EBUSY/EPERM when antivirus is scanning a fresh executable.
    const handle = runProcess(process.execPath, ['a\u0000b'], { shouldLog: () => false });
    const result = await handle.done;
    expect(result.code).toBeNull();
    expect(result.canceled).toBe(false);
    expect(result.stdout).toBe('');
    expect(result.log).toContain('spawn error');
    expect(() => handle.cancel()).not.toThrow();
  });
});

describe('chainRuns', () => {
  function manual(): RunHandle & { finish: (result: Partial<RunResult>) => void; canceled: boolean } {
    let resolve!: (result: RunResult) => void;
    const handle = {
      done: new Promise<RunResult>((r) => (resolve = r)),
      canceled: false,
      finish: (result: Partial<RunResult>) => resolve({ code: 0, canceled: false, stdout: '', log: '', ...result }),
      cancel: () => {
        handle.canceled = true;
        resolve({ code: null, canceled: true, stdout: '', log: '' });
      },
    };
    return handle;
  }

  it('runs the second step with the first result', async () => {
    const first = manual();
    const second = manual();
    const chained = chainRuns(first, (result) => {
      expect(result.stdout).toBe('found');
      return second;
    });
    first.finish({ stdout: 'found' });
    await Promise.resolve();
    second.finish({ code: 0, log: 'downloaded' });
    await expect(chained.done).resolves.toMatchObject({ code: 0, log: 'downloaded' });
  });

  it('cancels whichever step is running', async () => {
    const first = manual();
    const second = manual();
    const chained = chainRuns(first, () => second);
    first.finish({});
    await new Promise((r) => setTimeout(r, 0));
    chained.cancel();
    expect(second.canceled).toBe(true);
    await expect(chained.done).resolves.toMatchObject({ canceled: true });
  });

  it('does not start the second step after a cancel', async () => {
    const first = manual();
    let started = false;
    const chained = chainRuns(first, () => {
      started = true;
      return failedRun('never');
    });
    chained.cancel();
    await expect(chained.done).resolves.toMatchObject({ canceled: true });
    expect(started).toBe(false);
  });

  it('turns a throwing step into a failed run', async () => {
    const first = manual();
    const chained = chainRuns(first, () => {
      throw new Error('engine missing');
    });
    first.finish({});
    await expect(chained.done).resolves.toEqual({ code: 1, canceled: false, stdout: '', log: 'engine missing' });
  });
});
