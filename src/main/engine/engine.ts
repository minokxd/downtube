import { promises as fs } from 'node:fs';
import { basename, delimiter, join } from 'node:path';
import extract from 'extract-zip';
import type { EngineComponentId, EngineComponentStatus, EngineInstallProgress, EngineStatus, UpdateResult } from '@shared/types';
import type { EnginePaths } from '../ytdlp/args';
import { runProcess, type RunFn } from '../ytdlp/process';
import { parseChecksum, sha256File } from './checksum';
import { downloadFile, fetchText, withRetry, type FetchLike } from './download';
import { DEFAULT_SOURCES, type ComponentSource } from './sources';
import { parseDenoVersion, parseFfmpegVersion, parseYtdlpVersion } from './versions';

export interface EngineOptions {
  binDir: string;
  fetchImpl: FetchLike;
  sources?: Record<EngineComponentId, ComponentSource>;
  run?: RunFn;
  pathEnv?: string;
  retryDelaysMs?: number[];
  /** Delays between re-runs of a version probe whose process failed to spawn (e.g. antivirus holding a fresh exe). */
  versionRetryDelaysMs?: number[];
}

const PROGRESS_INTERVAL_MS = 100;

const exists = (path: string): Promise<boolean> =>
  fs.access(path).then(
    () => true,
    () => false,
  );

async function findFile(root: string, name: string): Promise<string | undefined> {
  const entries = await fs.readdir(root, { recursive: true, withFileTypes: true });
  const hit = entries.find((entry) => entry.isFile() && entry.name.toLowerCase() === name.toLowerCase());
  return hit ? join(hit.parentPath, hit.name) : undefined;
}

async function moveFile(from: string, to: string): Promise<void> {
  await fs.rm(to, { force: true });
  try {
    await fs.rename(from, to);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err;
    await fs.copyFile(from, to);
    await fs.rm(from, { force: true });
  }
}

export class Engine {
  private cachedPaths: EnginePaths | null = null;

  constructor(private readonly options: EngineOptions) {}

  private get run(): RunFn {
    return this.options.run ?? runProcess;
  }

  private get ytdlpPath(): string {
    return join(this.options.binDir, 'yt-dlp.exe');
  }

  private get denoPath(): string {
    return join(this.options.binDir, 'deno.exe');
  }

  private get bundledFfmpegDir(): string {
    return join(this.options.binDir, 'ffmpeg');
  }

  paths(): EnginePaths | null {
    return this.cachedPaths;
  }

  private async version(exe: string, args: string[], parse: (out: string) => string | undefined): Promise<string | undefined> {
    const delays = this.options.versionRetryDelaysMs ?? [300, 1000];
    for (let attempt = 0; ; attempt++) {
      const result = await this.run(exe, args, { collectStdout: true }).done;
      if (result.code === 0) return parse(result.stdout);
      // Only a spawn failure (code null) is worth retrying; a process that ran and failed will fail again.
      const delay = delays[attempt];
      if (result.code !== null || delay === undefined) return undefined;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  private async findSystemFfmpegDir(): Promise<string | undefined> {
    const dirs = (this.options.pathEnv ?? process.env.PATH ?? '').split(delimiter).filter(Boolean);
    for (const dir of dirs) {
      if ((await exists(join(dir, 'ffmpeg.exe'))) && (await exists(join(dir, 'ffprobe.exe')))) return dir;
    }
    return undefined;
  }

  private async fileComponent(
    id: EngineComponentId,
    path: string,
    parse: (out: string) => string | undefined,
  ): Promise<EngineComponentStatus> {
    if (!(await exists(path))) return { id, installed: false, source: 'missing' };
    return { id, installed: true, source: 'bundled', path, version: await this.version(path, ['--version'], parse) };
  }

  async status(): Promise<EngineStatus> {
    const ytdlp = await this.fileComponent('ytdlp', this.ytdlpPath, parseYtdlpVersion);
    const deno = await this.fileComponent('deno', this.denoPath, parseDenoVersion);
    let ffmpegDir = await this.findSystemFfmpegDir();
    let source: EngineComponentStatus['source'] = ffmpegDir ? 'system' : 'missing';
    if (
      !ffmpegDir &&
      (await exists(join(this.bundledFfmpegDir, 'ffmpeg.exe'))) &&
      (await exists(join(this.bundledFfmpegDir, 'ffprobe.exe')))
    ) {
      ffmpegDir = this.bundledFfmpegDir;
      source = 'bundled';
    }
    const ffmpeg: EngineComponentStatus = ffmpegDir
      ? {
          id: 'ffmpeg',
          installed: true,
          source,
          path: ffmpegDir,
          version: await this.version(join(ffmpegDir, 'ffmpeg.exe'), ['-version'], parseFfmpegVersion),
        }
      : { id: 'ffmpeg', installed: false, source: 'missing' };
    const components = [ytdlp, deno, ffmpeg];
    const ready = components.every((c) => c.installed && c.version !== undefined);
    this.cachedPaths = ready && ffmpegDir ? { ytdlp: this.ytdlpPath, deno: this.denoPath, ffmpegDir } : null;
    return { ready, components };
  }

  async install(onProgress: (progress: EngineInstallProgress) => void, force = false): Promise<EngineStatus> {
    const before = await this.status();
    for (const component of before.components) {
      const needed = force ? component.source !== 'system' : !(component.installed && component.version);
      if (needed) await this.installComponent(component.id, onProgress);
    }
    return this.status();
  }

  async installComponent(id: EngineComponentId, onProgress: (progress: EngineInstallProgress) => void): Promise<void> {
    const source = (this.options.sources ?? DEFAULT_SOURCES)[id];
    const tmpRoot = join(this.options.binDir, '.tmp');
    const tmpDir = join(tmpRoot, id);
    const downloaded = join(tmpDir, basename(new URL(source.url).pathname));
    let lastEmit = 0;
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
      await fs.mkdir(tmpDir, { recursive: true });
      await withRetry(async () => {
        onProgress({ component: id, phase: 'download', receivedBytes: 0 });
        const sums = await fetchText(this.options.fetchImpl, source.checksumUrl);
        const expected = parseChecksum(sums, source.checksumName);
        if (!expected) throw new Error(`No checksum published for ${source.checksumName}`);
        await downloadFile(this.options.fetchImpl, source.url, downloaded, (receivedBytes, totalBytes) => {
          const now = Date.now();
          if (now - lastEmit < PROGRESS_INTERVAL_MS && receivedBytes !== totalBytes) return;
          lastEmit = now;
          onProgress({ component: id, phase: 'download', receivedBytes, totalBytes });
        });
        onProgress({ component: id, phase: 'verify', receivedBytes: 0 });
        const actual = await sha256File(downloaded);
        if (actual !== expected) {
          await fs.rm(downloaded, { force: true });
          throw new Error(`Checksum mismatch for ${source.checksumName}`);
        }
      }, this.options.retryDelaysMs);

      const targetDir = id === 'ffmpeg' ? this.bundledFfmpegDir : this.options.binDir;
      await fs.mkdir(targetDir, { recursive: true });
      if (source.archive) {
        onProgress({ component: id, phase: 'extract', receivedBytes: 0 });
        const extractDir = join(tmpDir, 'x');
        await extract(downloaded, { dir: extractDir });
        for (const name of source.files) {
          const found = await findFile(extractDir, name);
          if (!found) throw new Error(`${name} not found in ${source.checksumName}`);
          await moveFile(found, join(targetDir, name));
        }
      } else {
        await moveFile(downloaded, join(targetDir, source.files[0] ?? basename(downloaded)));
      }
      onProgress({ component: id, phase: 'done', receivedBytes: 0 });
    } catch (err) {
      onProgress({ component: id, phase: 'error', receivedBytes: 0, error: err instanceof Error ? err.message : String(err) });
      throw err;
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async updateYtdlp(): Promise<UpdateResult> {
    if (!(await exists(this.ytdlpPath))) return { ok: false, message: 'yt-dlp is not installed' };
    const result = await this.run(this.ytdlpPath, ['-U'], { collectStdout: true }).done;
    const version = await this.version(this.ytdlpPath, ['--version'], parseYtdlpVersion);
    if (result.code === 0) return { ok: true, version };
    return { ok: false, version, message: (result.log || result.stdout).slice(-500) };
  }
}
