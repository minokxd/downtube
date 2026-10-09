import { createWriteStream, promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

export async function downloadFile(
  fetchImpl: FetchLike,
  url: string,
  dest: string,
  onProgress?: (receivedBytes: number, totalBytes?: number) => void,
): Promise<void> {
  const response = await fetchImpl(url);
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status} for ${url}`);
  const total = Number(response.headers.get('content-length')) || undefined;
  await fs.mkdir(dirname(dest), { recursive: true });
  const tmp = `${dest}.download`;
  let received = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      onProgress?.(received, total);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(response.body as unknown as NodeReadableStream), counter, createWriteStream(tmp));
    await fs.rm(dest, { force: true });
    await fs.rename(tmp, dest);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    throw err;
  }
}

export async function fetchText(fetchImpl: FetchLike, url: string): Promise<string> {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

export async function withRetry<T>(fn: () => Promise<T>, delaysMs: number[] = [1000, 3000]): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const delay = delaysMs[attempt];
      if (delay !== undefined) await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
