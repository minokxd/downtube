import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { downloadFile, fetchText, withRetry } from '../../src/main/engine/download';

const body = Buffer.alloc(200_000, 7);
let base: string;
let close: () => Promise<void>;
let dir: string;

beforeAll(async () => {
  const server = createServer((req, res) => {
    if (req.url === '/file.bin') {
      res.setHeader('Content-Length', String(body.length));
      res.end(body);
    } else if (req.url === '/redirect') {
      res.statusCode = 302;
      res.setHeader('Location', '/file.bin');
      res.end();
    } else if (req.url === '/sums') {
      res.end('hello sums');
    } else {
      res.statusCode = 404;
      res.end('missing');
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise((r) => server.close(() => r()));
  dir = await mkdtemp(join(tmpdir(), 'downtube-dl-'));
});

afterAll(async () => {
  await close();
  await rm(dir, { recursive: true, force: true });
});

describe('downloadFile', () => {
  it('streams to disk, follows redirects and reports progress', async () => {
    const seen: Array<[number, number | undefined]> = [];
    const dest = join(dir, 'out', 'file.bin');
    await downloadFile(fetch, `${base}/redirect`, dest, (received, total) => seen.push([received, total]));
    expect((await readFile(dest)).equals(body)).toBe(true);
    expect(seen.at(-1)).toEqual([body.length, body.length]);
    expect(await readdir(join(dir, 'out'))).toEqual(['file.bin']);
  });

  it('rejects on HTTP errors', async () => {
    await expect(downloadFile(fetch, `${base}/nope`, join(dir, 'x.bin'))).rejects.toThrow(/HTTP 404/);
  });
});

describe('fetchText', () => {
  it('returns the body text', async () => {
    expect(await fetchText(fetch, `${base}/sums`)).toBe('hello sums');
  });
});

describe('withRetry', () => {
  it('retries until success', async () => {
    let calls = 0;
    const value = await withRetry(async () => {
      calls += 1;
      if (calls < 3) throw new Error('flaky');
      return 'ok';
    }, [0, 0]);
    expect(value).toBe('ok');
    expect(calls).toBe(3);
  });

  it('gives up after the last delay', async () => {
    await expect(withRetry(async () => Promise.reject(new Error('down')), [0])).rejects.toThrow('down');
  });
});
