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

/** A finished run that never started a process, for a step that fails before yt-dlp runs. */
export const failedRun = (log: string): RunHandle => ({
  done: Promise.resolve({ code: 1, canceled: false, stdout: '', log }),
  cancel: () => undefined,
});

/**
 * Runs `first`, then whatever `then` starts from its result, as one cancelable run.
 * A cancel between the two steps stops the second one from starting.
 */
export function chainRuns(first: RunHandle, then: (result: RunResult) => RunHandle): RunHandle {
  let current = first;
  let canceled = false;
  const done = first.done.then((result) => {
    if (canceled || result.canceled) return { ...result, canceled: true };
    try {
      current = then(result);
    } catch (err) {
      return { code: 1, canceled: false, stdout: '', log: err instanceof Error ? err.message : String(err) };
    }
    return current.done;
  });
  return {
    done,
    cancel: () => {
      canceled = true;
      current.cancel();
    },
  };
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

  let child: ChildProcess;
  try {
    child = spawn(exe, args, {
      shell: false,
      windowsHide: true,
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', ...options.env },
    });
  } catch (error) {
    // spawn reports ENOENT/EACCES via 'error', but throws synchronously for EBUSY, EPERM, invalid arguments…
    const message = error instanceof Error ? error.message : String(error);
    return {
      done: Promise.resolve({ code: null, canceled: false, stdout: '', log: `spawn error: ${message}` }),
      cancel: () => undefined,
    };
  }

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
