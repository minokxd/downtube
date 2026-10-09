import { spawn, type ChildProcess } from 'node:child_process';
import { LineSplitter } from './output';

export type StreamName = 'stdout' | 'stderr';

export interface RunOptions {
  onLine?: (line: string, stream: StreamName) => void;
  collectStdout?: boolean;
  shouldLog?: (line: string) => boolean;
  logLimit?: number;
  env?: NodeJS.ProcessEnv;
}

export interface RunResult {
  code: number | null;
  canceled: boolean;
  stdout: string;
  log: string;
}

export interface RunHandle {
  readonly done: Promise<RunResult>;
  cancel(): void;
}

export type RunFn = (exe: string, args: string[], options?: RunOptions) => RunHandle;

export function killTree(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    // yt-dlp starts ffmpeg as a child; /T takes the whole tree down.
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    killer.on('error', () => child.kill());
  } else {
    child.kill('SIGTERM');
  }
}

export const runProcess: RunFn = (exe, args, options = {}) => {
  const limit = options.logLimit ?? 200;
  const log: string[] = [];
  let stdout = '';
  let canceled = false;

  const remember = (line: string): void => {
    if (options.shouldLog && !options.shouldLog(line)) return;
    log.push(line);
    if (log.length > limit) log.shift();
  };

  const child = spawn(exe, args, {
    shell: false,
    windowsHide: true,
    env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', ...options.env },
  });

  const splitter = (stream: StreamName): LineSplitter =>
    new LineSplitter((line) => {
      remember(line);
      options.onLine?.(line, stream);
    });
  const out = splitter('stdout');
  const err = splitter('stderr');

  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => {
    if (options.collectStdout) stdout += chunk;
    else out.push(chunk);
  });
  child.stderr?.on('data', (chunk: string) => err.push(chunk));

  const done = new Promise<RunResult>((resolve) => {
    let settled = false;
    const finish = (code: number | null): void => {
      if (settled) return;
      settled = true;
      out.flush();
      err.flush();
      resolve({ code, canceled, stdout, log: log.join('\n') });
    };
    child.on('error', (error) => {
      remember(`spawn error: ${error.message}`);
      finish(null);
    });
    child.on('close', (code) => finish(code));
  });

  return {
    done,
    cancel: () => {
      if (canceled) return;
      canceled = true;
      killTree(child);
    },
  };
};
