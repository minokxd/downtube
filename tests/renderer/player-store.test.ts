import type { LibraryItem } from '@shared/types';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal stand-in for HTMLAudioElement: enough for the player store under Vitest's node environment.
// Media events are dispatched asynchronously, as they are in a real element.
const instances: FakeAudio[] = [];

class FakeAudio extends EventTarget {
  preload = '';
  crossOrigin: string | null = null;
  volume = 1;
  muted = false;
  paused = true;
  currentTime = 0;
  duration = Number.NaN;
  readyState = 0;
  private readonly attributes = new Map<string, string>();

  constructor() {
    super();
    instances.push(this);
  }

  get src(): string {
    return this.getAttribute('src') ?? '';
  }

  set src(value: string) {
    this.setAttribute('src', value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  // Simplification: a source is treated as loaded at once, so the store's readyState guard lets saves through.
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === 'src') this.readyState = 4;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
    if (name === 'src') this.readyState = 0;
  }

  load(): void {
    this.currentTime = 0;
  }

  play(): Promise<void> {
    if (this.paused) {
      this.paused = false;
      setTimeout(() => this.dispatchEvent(new Event('play')), 0);
    }
    return Promise.resolve();
  }

  pause(): void {
    if (!this.paused) {
      this.paused = true;
      setTimeout(() => this.dispatchEvent(new Event('pause')), 0);
    }
  }
}

const saveProgress = vi.fn(async (_id: string, _positionSec: number, _durationSec?: number) => {});
const markPlayed = vi.fn(async (_id: string) => {});

const item = (id: string, extra: Partial<LibraryItem> = {}): LibraryItem =>
  ({
    id,
    videoId: id,
    kind: 'audio',
    title: id,
    channel: 'channel',
    durationSec: 100,
    filePath: `/music/${id}.mp3`,
    subtitles: [],
    sizeBytes: 1,
    addedAt: '',
    sourceUrl: '',
    collectionIds: [],
    progress: { positionSec: 0, updatedAt: '', completed: false },
    playCount: 0,
    ...extra,
  }) as LibraryItem;

const A = item('A');
const M = item('M', { missing: true });

type PlayerModule = typeof import('../../src/renderer/src/stores/player');
type LibraryModule = typeof import('../../src/renderer/src/stores/library');
type UiModule = typeof import('../../src/renderer/src/stores/ui');

let player: PlayerModule;
let library: LibraryModule;
let ui: UiModule;

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
const element = (): FakeAudio => instances[instances.length - 1] as FakeAudio;
const savedIds = (): string[] => saveProgress.mock.calls.map(([id]) => id);

beforeAll(async () => {
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('HTMLMediaElement', { HAVE_METADATA: 1 });
  vi.stubGlobal('window', { downtube: { library: { saveProgress, markPlayed } } });
  // Imported after the globals exist: the store creates its audio element on first use.
  player = await import('../../src/renderer/src/stores/player');
  library = await import('../../src/renderer/src/stores/library');
  ui = await import('../../src/renderer/src/stores/ui');
  library.useLibrary.setState({ items: [A, M], collections: [], loaded: true });
});

beforeEach(async () => {
  player.usePlayer.getState().clear();
  await tick();
  saveProgress.mockClear();
  markPlayed.mockClear();
  ui.useUi.setState({ toasts: [] });
});

describe('player store with a missing track', () => {
  it('unloads the element when Next runs into a missing last track', async () => {
    player.usePlayer.getState().playItems(['A', 'M']);
    player.usePlayer.getState().next();
    await tick();

    expect(element().getAttribute('src')).toBeNull();
    expect(player.usePlayer.getState().playing).toBe(false);
    expect(player.usePlayer.getState().order).toEqual(['A', 'M']);
    expect(savedIds()).not.toContain('M');
  });

  it('unloads the previous track when a missing track is started', async () => {
    player.usePlayer.getState().playItems(['A']);
    player.usePlayer.getState().playItems(['M']);
    await tick();

    expect(element().getAttribute('src')).toBeNull();
    expect(player.usePlayer.getState().playing).toBe(false);
    expect(savedIds()).not.toContain('M');
  });

  it('keeps the saved position of the last track when Next runs past the end', async () => {
    player.usePlayer.getState().playItems(['A']);
    element().currentTime = 42;
    element().duration = 100;
    player.usePlayer.getState().next();
    await tick();

    const positions = saveProgress.mock.calls.filter(([id]) => id === 'A').map(([, position]) => position);
    expect(positions[positions.length - 1]).toBe(42);
  });
});

describe('player store seek', () => {
  it('moves the stored time at once, so a controlled slider does not snap back while dragging', async () => {
    player.usePlayer.getState().playItems(['A']);
    await tick();
    player.usePlayer.getState().seek(37);
    expect(element().currentTime).toBe(37);
    expect(player.usePlayer.getState().currentTime).toBe(37);
  });

  it('clamps negative targets to zero and ignores non-finite ones', async () => {
    player.usePlayer.getState().playItems(['A']);
    await tick();
    player.usePlayer.getState().seek(12);
    player.usePlayer.getState().seek(-5);
    expect(player.usePlayer.getState().currentTime).toBe(0);
    player.usePlayer.getState().seek(12);
    player.usePlayer.getState().seek(Number.NaN);
    expect(player.usePlayer.getState().currentTime).toBe(12);
    expect(element().currentTime).toBe(12);
  });
});
