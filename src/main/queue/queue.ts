import { randomUUID } from 'node:crypto';
import type { AddJobsResult, Job, JobStatus, MediaKind, NewJobInput } from '@shared/types';
import { errorCodeOf, mapError } from '../ytdlp/errors';
import type { DoneInfo, YtdlpEvent } from '../ytdlp/output';
import type { RunHandle } from '../ytdlp/process';
import { ProgressTracker, initialProgress } from '../ytdlp/progress';

export interface QueueDeps {
  startDownload(job: Job, onEvent: (event: YtdlpEvent) => void): RunHandle;
  onCompleted(job: Job, done: DoneInfo): Promise<string>;
  isInLibrary(videoId: string, kind: MediaKind): boolean;
  cleanupPartials(job: Job): Promise<void>;
  persist(jobs: Job[]): Promise<void>;
  getConcurrency(): number;
  canStart(): boolean;
  /** Throttles progress notifications. 0 or undefined notifies immediately. */
  emitIntervalMs?: number;
  /** Debounces persistence. Defaults to 500 ms. */
  persistDelayMs?: number;
  /** How long shutdown waits for in-flight completions before pausing them. Defaults to 5000 ms. */
  shutdownTimeoutMs?: number;
}

const STATUSES: JobStatus[] = ['queued', 'downloading', 'processing', 'paused', 'done', 'failed', 'canceled'];
const ACTIVE: JobStatus[] = ['downloading', 'processing'];
const PENDING: JobStatus[] = ['queued', 'downloading', 'processing', 'paused'];

export function sanitizeJobs(raw: unknown): Job[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is Job => {
    if (typeof value !== 'object' || value === null) return false;
    const j = value as Partial<Job>;
    return (
      typeof j.id === 'string' &&
      typeof j.url === 'string' &&
      typeof j.videoId === 'string' &&
      (j.kind === 'video' || j.kind === 'audio') &&
      STATUSES.includes(j.status as JobStatus) &&
      typeof j.progress === 'object' &&
      j.progress !== null
    );
  });
}

export function restoreJobs(jobs: Job[]): Job[] {
  return jobs.map((job) =>
    ACTIVE.includes(job.status)
      ? { ...job, status: 'paused', progress: { ...job.progress, speedBps: undefined, etaSec: undefined } }
      : job,
  );
}

export class DownloadQueue {
  private jobs: Job[];
  private readonly running = new Map<string, RunHandle>();
  private readonly listeners = new Set<(jobs: Job[]) => void>();
  private readonly settling = new Set<Promise<void>>();
  private emitTimer: ReturnType<typeof setTimeout> | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private shuttingDown = false;

  constructor(
    private readonly deps: QueueDeps,
    initial: Job[] = [],
  ) {
    this.jobs = restoreJobs(initial);
  }

  list(): Job[] {
    return structuredClone(this.jobs);
  }

  isIdle(): boolean {
    return this.running.size === 0;
  }

  add(inputs: NewJobInput[]): AddJobsResult {
    const result: AddJobsResult = { added: 0, skipped: [] };
    for (const input of inputs) {
      if (this.deps.isInLibrary(input.videoId, input.kind)) {
        result.skipped.push({ videoId: input.videoId, reason: 'in-library' });
        continue;
      }
      const duplicate = this.jobs.some((j) => j.videoId === input.videoId && j.kind === input.kind && PENDING.includes(j.status));
      if (duplicate) {
        result.skipped.push({ videoId: input.videoId, reason: 'in-queue' });
        continue;
      }
      this.jobs.push({ ...input, id: randomUUID(), status: 'queued', progress: initialProgress(), createdAt: new Date().toISOString() });
      result.added += 1;
    }
    if (result.added > 0) this.changed(true);
    this.pump();
    return result;
  }

  cancel(id: string): void {
    const job = this.find(id);
    if (!job) return;
    const handle = this.running.get(id);
    if (handle) {
      handle.cancel();
      return;
    }
    if (job.status === 'queued' || job.status === 'paused') {
      job.status = 'canceled';
      void this.deps.cleanupPartials(job).catch(() => undefined);
      this.changed(true);
    }
  }

  retry(id: string): void {
    const job = this.find(id);
    if (!job || this.running.has(id) || !['failed', 'canceled', 'paused'].includes(job.status)) return;
    const resuming = job.status === 'paused';
    job.status = 'queued';
    delete job.error;
    if (!resuming) job.progress = initialProgress();
    this.changed(true);
    this.pump();
  }

  remove(id: string): void {
    const job = this.find(id);
    if (!job || this.running.has(id) || PENDING.includes(job.status)) return;
    this.jobs = this.jobs.filter((j) => j.id !== id);
    this.changed(true);
  }

  clearFinished(): void {
    this.jobs = this.jobs.filter((j) => j.status !== 'done' && j.status !== 'canceled');
    this.changed(true);
  }

  pump(): void {
    if (this.shuttingDown) return;
    while (this.running.size < this.deps.getConcurrency() && this.deps.canStart()) {
      const next = this.jobs.find((j) => j.status === 'queued');
      if (!next) break;
      this.start(next);
    }
  }

  async flush(): Promise<void> {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = null;
    await this.deps.persist(this.list());
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    for (const handle of this.running.values()) handle.cancel();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, this.deps.shutdownTimeoutMs ?? 5000);
    });
    await Promise.race([Promise.allSettled([...this.settling]), timeout]);
    clearTimeout(timer);
    for (const job of this.jobs) if (ACTIVE.includes(job.status)) job.status = 'paused';
    try {
      await this.flush();
    } catch (err) {
      console.error('[queue] shutdown flush failed', err);
    }
  }

  onChange(listener: (jobs: Job[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private find(id: string): Job | undefined {
    return this.jobs.find((j) => j.id === id);
  }

  private start(job: Job): void {
    const tracker = new ProgressTracker(job.kind);
    let done: DoneInfo | undefined;
    job.status = 'downloading';
    delete job.error;
    let handle: RunHandle;
    try {
      handle = this.deps.startDownload(job, (event) => {
        try {
          if (event.type === 'done') {
            done = event.info;
            return;
          }
          const progress = tracker.apply(event);
          if (!progress) return;
          job.progress = { ...progress, percent: Math.max(progress.percent, job.progress.percent) };
          const status: JobStatus = progress.stage === 'download' ? 'downloading' : 'processing';
          const statusChanged = status !== job.status;
          job.status = status;
          this.changed(statusChanged);
        } catch (err) {
          // Runs inside a child-process 'data' handler; nothing may escape it.
          console.error('[queue] progress event failed', err);
        }
      });
    } catch (err) {
      job.status = 'failed';
      job.error = { code: errorCodeOf(err), log: err instanceof Error ? err.message : String(err) };
      this.changed(true);
      return;
    }
    this.running.set(job.id, handle);
    this.changed(true);
    const settled: Promise<void> = handle.done
      .then(async (result) => {
        try {
          if (result.canceled) {
            if (this.shuttingDown) {
              job.status = 'paused';
              return;
            }
            job.status = 'canceled';
            job.progress = { ...job.progress, speedBps: undefined, etaSec: undefined };
            await this.deps.cleanupPartials(job);
            return;
          }
          if (result.code === 0 && done) {
            try {
              job.libraryItemId = await this.deps.onCompleted(job, done);
              job.status = 'done';
              job.progress = { ...job.progress, percent: 100, speedBps: undefined, etaSec: undefined };
            } catch (err) {
              job.status = 'failed';
              job.error = { code: 'UNKNOWN', log: err instanceof Error ? err.message : String(err) };
            }
            return;
          }
          if (this.shuttingDown) {
            job.status = 'paused';
            return;
          }
          job.status = 'failed';
          job.error = { code: result.code === 0 ? 'UNKNOWN' : mapError(result.log), log: result.log };
          if (job.error.code === 'DISK_FULL') await this.deps.cleanupPartials(job);
        } finally {
          // A retry during cleanup must not have its new handle removed here.
          if (this.running.get(job.id) === handle) this.running.delete(job.id);
          this.changed(true);
          this.pump();
        }
      })
      .catch((err) => console.error('[queue] completion failed', err));
    this.settling.add(settled);
    void settled.finally(() => this.settling.delete(settled));
  }

  private changed(immediate: boolean): void {
    this.schedulePersist();
    const interval = this.deps.emitIntervalMs ?? 0;
    if (immediate || interval <= 0) {
      this.flushEmit();
      return;
    }
    if (this.emitTimer) return;
    this.emitTimer = setTimeout(() => this.flushEmit(), interval);
  }

  private flushEmit(): void {
    if (this.emitTimer) clearTimeout(this.emitTimer);
    this.emitTimer = null;
    const snapshot = this.list();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[queue] listener failed', err);
      }
    }
  }

  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.deps.persist(this.list()).catch((err) => console.error('[queue] persist failed', err));
    }, this.deps.persistDelayMs ?? 500);
  }
}
