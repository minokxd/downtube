import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runProcess, type RunOptions, type StreamName } from '../../src/main/ytdlp/process';

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
});
