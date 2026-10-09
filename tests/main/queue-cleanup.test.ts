import { promises } from 'node:fs';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupPartialFiles } from '../../src/main/queue/cleanup';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'downtube-cleanup-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const touch = (...names: string[]) => Promise.all(names.map((name) => writeFile(join(dir, name), 'x')));

describe('cleanupPartialFiles', () => {
  it('removes partial downloads and orphaned sidecars of the canceled video', async () => {
    await touch(
      'A [abcdefghijk].f137.mp4.part',
      'A [abcdefghijk].f140.m4a',
      'A [abcdefghijk].mp4.ytdl',
      'A [abcdefghijk].webp',
      'A [abcdefghijk].en.vtt',
      'B [zzzzzzzzzzz].f137.mp4.part',
    );
    await cleanupPartialFiles(dir, 'abcdefghijk');
    expect((await readdir(dir)).sort()).toEqual(['B [zzzzzzzzzzz].f137.mp4.part']);
  });

  it('keeps sidecars when the finished media file exists', async () => {
    await touch('A [abcdefghijk].mp4', 'A [abcdefghijk].jpg', 'A [abcdefghijk].f137.mp4.part');
    await cleanupPartialFiles(dir, 'abcdefghijk');
    expect((await readdir(dir)).sort()).toEqual(['A [abcdefghijk].jpg', 'A [abcdefghijk].mp4']);
  });

  it('retries removal, since files are often still locked right after the process tree was killed', async () => {
    await touch('A [abcdefghijk].f137.mp4.part');
    const rm = vi.spyOn(promises, 'rm');
    try {
      await cleanupPartialFiles(dir, 'abcdefghijk');
      expect(rm).toHaveBeenCalledWith(join(dir, 'A [abcdefghijk].f137.mp4.part'), { force: true, maxRetries: 5, retryDelay: 100 });
    } finally {
      rm.mockRestore();
    }
  });

  it('ignores a missing folder', async () => {
    expect(await cleanupPartialFiles(join(dir, 'missing'), 'abcdefghijk')).toEqual([]);
  });
});
