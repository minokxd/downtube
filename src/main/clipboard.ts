import { classifyUrl } from '@shared/youtube-url';

/** Electron's main-process clipboard reads are asynchronous, so a reader may return a promise. */
export type ClipboardReader = () => string | Promise<string>;

export class ClipboardWatcher {
  private timer: ReturnType<typeof setInterval> | null = null;
  private last = '';
  private readonly notified = new Set<string>();
  // Bumped by start() and stop() so a slow read from an earlier run is dropped.
  private epoch = 0;
  private reading = false;

  constructor(
    private readonly read: ClipboardReader,
    private readonly onLink: (url: string) => void,
    private readonly intervalMs = 1500,
  ) {}

  start(): void {
    if (this.timer) return;
    this.epoch += 1;
    this.reading = false;
    // Whatever was copied before the app started is not announced.
    this.sample((text) => {
      this.last = text;
    });
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.epoch += 1;
    this.reading = false;
  }

  tick(): void {
    this.sample((text) => this.accept(text));
  }

  private accept(text: string): void {
    if (text === this.last) return;
    this.last = text;
    const info = classifyUrl(text);
    if (info.kind === 'invalid') return;
    if (this.notified.has(info.url)) return;
    this.notified.add(info.url);
    this.onLink(text);
  }

  // A failed read keeps the previous state; a read still in flight is not overlapped.
  private sample(apply: (text: string) => void): void {
    if (this.reading) return;
    let result: string | Promise<string>;
    try {
      result = this.read();
    } catch {
      return;
    }
    if (typeof result === 'string') {
      apply(result.trim());
      return;
    }
    const epoch = this.epoch;
    this.reading = true;
    result
      .then(
        (text) => {
          if (epoch === this.epoch) apply(text.trim());
        },
        () => undefined,
      )
      .catch((err: unknown) => console.error('[clipboard] link handler failed', err))
      .finally(() => {
        if (epoch === this.epoch) this.reading = false;
      });
  }
}
