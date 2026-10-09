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
      void this.deps.cleanupPartials(job);
      this.changed(true);
    }
  }

  retry(id: string): void {
    const job = this.find(id);
    if (!job || !['failed', 'canceled', 'paused'].includes(job.status)) return;
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
    const pending = [...this.running.values()].map((handle) => {
      handle.cancel();
      return handle.done;
    });
    await Promise.allSettled(pending);
    for (const job of this.jobs) if (ACTIVE.includes(job.status)) job.status = 'paused';
    await this.flush();
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
      });
    } catch (err) {
      job.status = 'failed';
      job.error = { code: errorCodeOf(err), log: err instanceof Error ? err.message : String(err) };
      this.changed(true);
      return;
    }
    this.running.set(job.id, handle);
    this.changed(true);
    void handle.done.then(async (result) => {
      try {
        if (this.shuttingDown) {
          job.status = 'paused';
          return;
        }
        if (result.canceled) {
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
        job.status = 'failed';
        job.error = { code: result.code === 0 ? 'UNKNOWN' : mapError(result.log), log: result.log };
        if (job.error.code === 'DISK_FULL') await this.deps.cleanupPartials(job);
      } finally {
        this.running.delete(job.id);
        this.changed(true);
        this.pump();
      }
    });
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
    for (const listener of this.listeners) listener(snapshot);
  }

  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.deps.persist(this.list());
    }, this.deps.persistDelayMs ?? 500);
  }
}
