import { promises as fs } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JsonFile } from '../../src/main/json-store';

interface Data {
  count: number;
}

const defaults = (): Data => ({ count: 0 });
const sanitize = (raw: unknown): Data => {
  const value = (raw as { count?: unknown } | null)?.count;
  return typeof value === 'number' ? { count: value } : defaults();
};

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'downtube-json-'));
  file = join(dir, 'data.json');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('JsonFile', () => {
  it('returns defaults when the file does not exist', async () => {
    const result = await new JsonFile<Data>(file).read(defaults, sanitize);
    expect(result).toEqual({ value: { count: 0 }, recovered: 'none' });
  });

  it('writes and reads back without leaving a temp file', async () => {
    const store = new JsonFile<Data>(file);
    await store.write({ count: 1 });
    expect((await store.read(defaults, sanitize)).value).toEqual({ count: 1 });
    expect(await readdir(dir)).not.toContain('data.json.tmp');
  });

  it('keeps the previous version as a backup', async () => {
    const store = new JsonFile<Data>(file);
    await store.write({ count: 1 });
    await store.write({ count: 2 });
    expect(JSON.parse(await readFile(`${file}.bak`, 'utf8'))).toEqual({ count: 1 });
  });

  it('recovers from the backup when the main file is corrupt', async () => {
    const store = new JsonFile<Data>(file);
    await store.write({ count: 1 });
    await store.write({ count: 2 });
    await writeFile(file, '{broken', 'utf8');
    expect(await store.read(defaults, sanitize)).toEqual({ value: { count: 1 }, recovered: 'backup' });
  });

  it('resets and keeps the corrupt file when nothing is readable', async () => {
    await writeFile(file, '{broken', 'utf8');
    const result = await new JsonFile<Data>(file).read(defaults, sanitize);
    expect(result).toEqual({ value: { count: 0 }, recovered: 'reset' });
    expect((await readdir(dir)).some((name) => name.startsWith('data.json.corrupt-'))).toBe(true);
  });

  it('serialises concurrent writes', async () => {
    const store = new JsonFile<Data>(file);
    await Promise.all([store.write({ count: 1 }), store.write({ count: 2 }), store.write({ count: 3 })]);
    expect((await store.read(defaults, sanitize)).value).toEqual({ count: 3 });
  });

  it('retries a transient read lock instead of treating a valid file as corrupt', async () => {
    const store = new JsonFile<Data>(file);
    await store.write({ count: 7 });
    const spy = vi.spyOn(fs, 'readFile').mockRejectedValueOnce(Object.assign(new Error('busy'), { code: 'EBUSY' }));
    try {
      expect(await store.read(defaults, sanitize)).toEqual({ value: { count: 7 }, recovered: 'none' });
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      spy.mockRestore();
    }
  });
});
