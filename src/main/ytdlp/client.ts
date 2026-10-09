import type { ProbeResult } from '@shared/types';
import { classifyUrl } from '@shared/youtube-url';
import { PROGRESS_PREFIX, buildDownloadArgs, buildProbeArgs, type DownloadArgsInput, type EnginePaths } from './args';
import { YtdlpError, mapError } from './errors';
import { parseLine, type YtdlpEvent } from './output';
import { normalizeList, normalizeVideo } from './probe-normalize';
import { runProcess, type RunFn, type RunHandle } from './process';

export const PAGE_SIZE = 100;

export interface YtdlpClientDeps {
  getPaths: () => EnginePaths | null;
  run?: RunFn;
}

export class YtdlpClient {
  constructor(private readonly deps: YtdlpClientDeps) {}

  private paths(): EnginePaths {
    const paths = this.deps.getPaths();
    if (!paths) throw new YtdlpError('ENGINE_MISSING');
    return paths;
  }

  private get run(): RunFn {
    return this.deps.run ?? runProcess;
  }

  async probe(url: string, start = 1): Promise<ProbeResult> {
    const info = classifyUrl(url);
    if (info.kind === 'invalid') throw new YtdlpError('INVALID_URL');
    const paths = this.paths();
    const args =
      info.kind === 'video'
        ? buildProbeArgs(paths, { url: info.url, list: false })
        : buildProbeArgs(paths, { url: info.url, list: true, start, end: start + PAGE_SIZE - 1 });
    const result = await this.run(paths.ytdlp, args, { collectStdout: true }).done;
    if (result.code !== 0) throw new YtdlpError(mapError(result.log), result.log);
    let json: unknown;
    try {
      json = JSON.parse(result.stdout);
    } catch {
      throw new YtdlpError('UNKNOWN', result.log);
    }
    if (info.kind === 'video') return { type: 'video', video: normalizeVideo(json, info.listId) };
    return { type: 'list', list: normalizeList(json, info.kind, info.url, start, PAGE_SIZE) };
  }

  download(input: DownloadArgsInput, onEvent: (event: YtdlpEvent) => void): RunHandle {
    const paths = this.paths();
    return this.run(paths.ytdlp, buildDownloadArgs(paths, input), {
      onLine: (line) => onEvent(parseLine(line)),
      shouldLog: (line) => !line.startsWith(PROGRESS_PREFIX),
    });
  }
}
