import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { EngineComponentId, EngineInstallProgress } from '@shared/types';
import { Engine } from '../../src/main/engine/engine';
import type { ComponentSource } from '../../src/main/engine/sources';
import { parseDenoVersion, parseFfmpegVersion, parseYtdlpVersion } from '../../src/main/engine/versions';
import type { RunFn } from '../../src/main/ytdlp/process';

const sha = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const routes: Record<string, Buffer | string> = {};
let zip: Buffer;
let base: string;
let closeServer: () => Promise<void>;
let dir: string;

beforeAll(async () => {
  zip = await readFile(resolve('tests/fixtures/archive.zip'));
  const server = createServer((req, res) => {
    const payload = routes[req.url ?? ''];
    if (payload === undefined) {
      res.statusCode = 404;
      res.end();
      return;
    }
    const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  closeServer = () => new Promise((r) => server.close(() => r()));
});

afterAll(async () => {
  await closeServer();
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'downtube-engine-'));
  routes['/yt-dlp.exe'] = 'fake-ytdlp';
  routes['/SHA2-256SUMS'] = `${'0'.repeat(64)}  yt-dlp_linux\n${sha('fake-ytdlp')}  yt-dlp.exe\n`;
  routes['/deno.zip'] = zip;
  routes['/deno.zip.sha256sum'] = `\r\nAlgorithm : SHA256\r\nHash      : ${sha(zip).toUpperCase()}\r\nPath      : C:\\deno.zip\r\n`;
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const sources = (): Record<EngineComponentId, ComponentSource> => ({
  ytdlp: { id: 'ytdlp', url: `${base}/yt-dlp.exe`, checksumUrl: `${base}/SHA2-256SUMS`, checksumName: 'yt-dlp.exe', archive: false, files: ['yt-dlp.exe'] },
  deno: { id: 'deno', url: `${base}/deno.zip`, checksumUrl: `${base}/deno.zip.sha256sum`, checksumName: 'deno.zip', archive: true, files: ['tool.exe'] },
  ffmpeg: { id: 'ffmpeg', url: `${base}/none.zip`, checksumUrl: `${base}/none`, checksumName: 'none.zip', archive: true, files: ['ffmpeg.exe'] },
});

const fakeRun: RunFn = (exe) => {
  const stdout = exe.endsWith('yt-dlp.exe')
    ? '2026.08.19\n'
    : exe.endsWith('deno.exe')
      ? 'deno 2.9.7 (stable, release, x86_64-pc-windows-msvc)\n'
      : 'ffmpeg version 9.0.1-full_build-www.gyan.dev Copyright (c) 2000-2026\n';
  return { done: Promise.resolve({ code: 0, canceled: false, stdout, log: '' }), cancel: () => undefined };
};

const touch = async (path: string) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, 'x');
};

describe('version parsers', () => {
  it('parse tool output', () => {
    expect(parseYtdlpVersion('2026.08.19\n')).toBe('2026.08.19');
    expect(parseDenoVersion('deno 2.9.7 (stable, release, x86_64-pc-windows-msvc)\nv8 15.0')).toBe('2.9.7');
    expect(parseFfmpegVersion('ffmpeg version 9.0.1-full_build-www.gyan.dev Copyright')).toBe('9.0.1-full_build-www.gyan.dev');
    expect(parseDenoVersion('garbage')).toBeUndefined();
  });
});

describe('Engine.status', () => {
  it('reports missing components', async () => {
    const engine = new Engine({ binDir: join(dir, 'bin'), fetchImpl: fetch, run: fakeRun, pathEnv: '' });
    const status = await engine.status();
    expect(status.ready).toBe(false);
    expect(status.components.map((c) => [c.id, c.installed, c.source])).toEqual([
      ['ytdlp', false, 'missing'],
      ['deno', false, 'missing'],
      ['ffmpeg', false, 'missing'],
    ]);
    expect(engine.paths()).toBeNull();
  });

  it('prefers ffmpeg from PATH and becomes ready', async () => {
    const bin = join(dir, 'bin');
    const system = join(dir, 'system');
    await touch(join(bin, 'yt-dlp.exe'));
    await touch(join(bin, 'deno.exe'));
    await touch(join(system, 'ffmpeg.exe'));
    await touch(join(system, 'ffprobe.exe'));
    const engine = new Engine({ binDir: bin, fetchImpl: fetch, run: fakeRun, pathEnv: system });
    const status = await engine.status();
    expect(status.ready).toBe(true);
    expect(status.components.find((c) => c.id === 'ffmpeg')).toMatchObject({
      source: 'system',
      version: '9.0.1-full_build-www.gyan.dev',
      path: system,
    });
    expect(engine.paths()).toEqual({ ytdlp: join(bin, 'yt-dlp.exe'), deno: join(bin, 'deno.exe'), ffmpegDir: system });
  });

  it('retries a version probe whose process failed to spawn (code null) before giving up', async () => {
    const bin = join(dir, 'bin');
    const system = join(dir, 'system');
    await touch(join(bin, 'yt-dlp.exe'));
    await touch(join(bin, 'deno.exe'));
    await touch(join(system, 'ffmpeg.exe'));
    await touch(join(system, 'ffprobe.exe'));
    let ytdlpVersionCalls = 0;
    const run: RunFn = (exe, args, options) => {
      if (exe.endsWith('yt-dlp.exe') && args[0] === '--version' && ytdlpVersionCalls++ === 0) {
        return { done: Promise.resolve({ code: null, canceled: false, stdout: '', log: 'spawn error: EBUSY' }), cancel: () => undefined };
      }
      return fakeRun(exe, args, options);
    };
    const engine = new Engine({ binDir: bin, fetchImpl: fetch, run, pathEnv: system, versionRetryDelaysMs: [0, 0] });
    const status = await engine.status();
    expect(ytdlpVersionCalls).toBe(2);
    expect(status.components.find((c) => c.id === 'ytdlp')).toMatchObject({ installed: true, version: '2026.08.19' });
    expect(status.ready).toBe(true);
    expect(engine.paths()).not.toBeNull();
  });

  it('gives up (no version, not ready) once the spawn-failure retries are exhausted', async () => {
    const bin = join(dir, 'bin');
    await touch(join(bin, 'yt-dlp.exe'));
    let calls = 0;
    const run: RunFn = () => {
      calls++;
      return { done: Promise.resolve({ code: null, canceled: false, stdout: '', log: 'spawn error: EBUSY' }), cancel: () => undefined };
    };
    const engine = new Engine({ binDir: bin, fetchImpl: fetch, run, pathEnv: '', versionRetryDelaysMs: [0, 0] });
    const status = await engine.status();
    expect(calls).toBe(3);
    expect(status.components.find((c) => c.id === 'ytdlp')).toMatchObject({ installed: true, version: undefined });
    expect(status.ready).toBe(false);
    expect(engine.paths()).toBeNull();
  });

  it('does not retry a version probe that ran and exited with an error code', async () => {
    const bin = join(dir, 'bin');
    await touch(join(bin, 'yt-dlp.exe'));
    let calls = 0;
    const run: RunFn = () => {
      calls++;
      return { done: Promise.resolve({ code: 1, canceled: false, stdout: '', log: 'boom' }), cancel: () => undefined };
    };
    const engine = new Engine({ binDir: bin, fetchImpl: fetch, run, pathEnv: '', versionRetryDelaysMs: [0, 0] });
    await engine.status();
    expect(calls).toBe(1);
  });

  it('falls back to the bundled ffmpeg', async () => {
    const bin = join(dir, 'bin');
    await touch(join(bin, 'ffmpeg', 'ffmpeg.exe'));
    await touch(join(bin, 'ffmpeg', 'ffprobe.exe'));
    const engine = new Engine({ binDir: bin, fetchImpl: fetch, run: fakeRun, pathEnv: '' });
    const status = await engine.status();
    expect(status.components.find((c) => c.id === 'ffmpeg')).toMatchObject({ source: 'bundled', installed: true });
  });
});

describe('Engine.installComponent', () => {
  it('downloads, verifies and places a plain file', async () => {
    const bin = join(dir, 'bin');
    const phases: string[] = [];
    const engine = new Engine({ binDir: bin, fetchImpl: fetch, run: fakeRun, pathEnv: '', sources: sources(), retryDelaysMs: [] });
    await engine.installComponent('ytdlp', (p: EngineInstallProgress) => phases.push(p.phase));
    expect(await readFile(join(bin, 'yt-dlp.exe'), 'utf8')).toBe('fake-ytdlp');
    expect(phases[0]).toBe('download');
    expect(phases).toContain('verify');
    expect(phases.at(-1)).toBe('done');
    expect(await readdir(bin)).not.toContain('.tmp');
  });

  it('extracts the wanted file from an archive', async () => {
    const bin = join(dir, 'bin');
    const phases: string[] = [];
    const engine = new Engine({ binDir: bin, fetchImpl: fetch, run: fakeRun, pathEnv: '', sources: sources(), retryDelaysMs: [] });
    await engine.installComponent('deno', (p) => phases.push(p.phase));
    expect(await readFile(join(bin, 'tool.exe'), 'utf8')).toBe('tool');
    expect(phases).toContain('extract');
  });

  it('refuses a file whose checksum does not match', async () => {
    routes['/SHA2-256SUMS'] = `${'f'.repeat(64)}  yt-dlp.exe\n`;
    const bin = join(dir, 'bin');
    const progress: EngineInstallProgress[] = [];
    const engine = new Engine({ binDir: bin, fetchImpl: fetch, run: fakeRun, pathEnv: '', sources: sources(), retryDelaysMs: [0] });
    await expect(engine.installComponent('ytdlp', (p) => progress.push(p))).rejects.toThrow(/checksum/i);
    expect(progress.at(-1)?.phase).toBe('error');
    await expect(readFile(join(bin, 'yt-dlp.exe'))).rejects.toThrow();
  });
});

describe('Engine.install', () => {
  it('installs only what is missing and skips a system ffmpeg', async () => {
    const bin = join(dir, 'bin');
    const system = join(dir, 'system');
    await touch(join(system, 'ffmpeg.exe'));
    await touch(join(system, 'ffprobe.exe'));
    await touch(join(bin, 'deno.exe'));
    const seen = new Set<string>();
    const engine = new Engine({ binDir: bin, fetchImpl: fetch, run: fakeRun, pathEnv: system, sources: sources(), retryDelaysMs: [] });
    const status = await engine.install((p) => seen.add(p.component));
    expect([...seen]).toEqual(['ytdlp']);
    expect(status.ready).toBe(true);
  });
});

describe('Engine.updateYtdlp', () => {
  it('runs the self updater and reports the version', async () => {
    const bin = join(dir, 'bin');
    await touch(join(bin, 'yt-dlp.exe'));
    const calls: string[][] = [];
    const run: RunFn = (exe, args, options) => {
      calls.push(args);
      return fakeRun(exe, args, options);
    };
    const engine = new Engine({ binDir: bin, fetchImpl: fetch, run, pathEnv: '' });
    expect(await engine.updateYtdlp()).toEqual({ ok: true, version: '2026.08.19' });
    expect(calls[0]).toEqual(['-U']);
  });

  it('reports a missing yt-dlp', async () => {
    const engine = new Engine({ binDir: join(dir, 'bin'), fetchImpl: fetch, run: fakeRun, pathEnv: '' });
    expect((await engine.updateYtdlp()).ok).toBe(false);
  });
});
