import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';

export type RecoveryState = 'none' | 'backup' | 'reset';

export interface ReadResult<T> {
  value: T;
  recovered: RecoveryState;
}

// OneDrive and antivirus scanners briefly lock files on Windows.
const RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES']);

async function withFsRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (attempt >= attempts || !code || !RETRYABLE.has(code)) throw err;
      await new Promise((resolve) => setTimeout(resolve, 40 * attempt));
    }
  }
}

async function readParsed<T>(
  filePath: string,
  sanitize: (raw: unknown) => T,
): Promise<{ ok: true; value: T } | { ok: false; missing: boolean }> {
  let text: string;
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    return { ok: false, missing: (err as NodeJS.ErrnoException).code === 'ENOENT' };
  }
  try {
    return { ok: true, value: sanitize(JSON.parse(text) as unknown) };
  } catch {
    return { ok: false, missing: false };
  }
}

export class JsonFile<T> {
  private chain: Promise<void> = Promise.resolve();

  constructor(readonly filePath: string) {}

  get backupPath(): string {
    return `${this.filePath}.bak`;
  }

  async read(defaults: () => T, sanitize: (raw: unknown) => T): Promise<ReadResult<T>> {
    const main = await readParsed(this.filePath, sanitize);
    if (main.ok) return { value: main.value, recovered: 'none' };
    const backup = await readParsed(this.backupPath, sanitize);
    if (backup.ok) return { value: backup.value, recovered: 'backup' };
    if (main.missing) return { value: defaults(), recovered: 'none' };
    await fs.rename(this.filePath, `${this.filePath}.corrupt-${Date.now()}`).catch(() => undefined);
    return { value: defaults(), recovered: 'reset' };
  }

  write(value: T): Promise<void> {
    const run = async (): Promise<void> => {
      await fs.mkdir(dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
      try {
        await withFsRetry(() => fs.copyFile(this.filePath, this.backupPath));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
      await withFsRetry(() => fs.rename(tmp, this.filePath));
    };
    const next = this.chain.then(run, run);
    this.chain = next.catch(() => undefined);
    return next;
  }

  idle(): Promise<void> {
    return this.chain;
  }
}
