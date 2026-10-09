import { create } from 'zustand';
import type { MessageKey } from '../i18n/tr';
import { translate } from '../i18n/translate';
import { mediaUrl } from '../lib/media-url';
import { clearMediaSession, setMediaSessionPlaying, updateMediaSession } from '../player/media-session';
import { createProgressSaver } from '../player/progress-saver';
import { moveInOrder, nextIndex, prevIndex, removeFromOrder, shuffleOrder, type RepeatMode } from '../player/queue-logic';
import { resumeStart } from '../player/resume';
import { findItem } from './library';
import { useSettings } from './settings';
import { useUi } from './ui';

export interface PlayerState {
  source: string[];
  order: string[];
  index: number;
  shuffle: boolean;
  repeat: RepeatMode;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  queueOpen: boolean;
  playItems: (ids: string[], startIndex?: number, options?: { shuffle?: boolean }) => void;
  enqueue: (ids: string[]) => void;
  jumpTo: (index: number) => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  removeAt: (index: number) => void;
  move: (index: number, direction: -1 | 1) => void;
  clear: () => void;
  setQueueOpen: (open: boolean) => void;
}

const saver = createProgressSaver((id, position, duration) => {
  void window.downtube.library.saveProgress(id, position, duration);
});

// One audio element for the whole app: it lives outside React so music keeps
// playing while the user moves between pages.
let audio: HTMLAudioElement | null = null;
// Counts consecutive tracks that could not be played, so a broken queue cannot loop forever.
let skips = 0;
// Resume seek waiting for loadedmetadata. Dropped when another track loads, so it never moves that track.
let pendingSeek: (() => void) | null = null;
// The track whose media is actually in the element. It can differ from the queue's current track
// when that track is missing or unplayable, so progress is always written for this id.
let loadedId: string | null = null;

const notify = (key: MessageKey): void => {
  const language = useSettings.getState().settings?.language ?? 'tr';
  useUi.getState().pushToast({ message: translate(language, key), tone: 'error' });
};

const currentId = (): string | undefined => {
  const { order, index } = usePlayer.getState();
  return order[index];
};

const hasSource = (el: HTMLAudioElement): boolean => el.getAttribute('src') !== null;

// Before metadata loads, currentTime is 0 and the duration is unknown. Saving then would overwrite the stored resume position.
const hasMetadata = (el: HTMLAudioElement): boolean => el.readyState >= HTMLMediaElement.HAVE_METADATA;

function flushCurrent(): void {
  if (loadedId && audio && hasSource(audio) && hasMetadata(audio)) saver.flush(loadedId, audio.currentTime, audio.duration);
}

function cancelPendingSeek(el: HTMLAudioElement): void {
  if (pendingSeek) el.removeEventListener('loadedmetadata', pendingSeek);
  pendingSeek = null;
}

const sessionHandlers = {
  play: () => usePlayer.getState().play(),
  pause: () => usePlayer.getState().pause(),
  next: () => usePlayer.getState().next(),
  previous: () => usePlayer.getState().previous(),
  seek: (time: number) => usePlayer.getState().seek(time),
};

function audioElement(): HTMLAudioElement {
  if (audio) return audio;
  const el = new Audio();
  el.preload = 'auto';
  el.crossOrigin = 'anonymous';
  el.volume = usePlayer.getState().volume;
  el.addEventListener('timeupdate', () => {
    usePlayer.setState({ currentTime: el.currentTime });
    if (loadedId && hasMetadata(el)) saver.update(loadedId, el.currentTime, el.duration);
  });
  el.addEventListener('durationchange', () => usePlayer.setState({ duration: Number.isFinite(el.duration) ? el.duration : 0 }));
  el.addEventListener('playing', () => {
    skips = 0;
  });
  el.addEventListener('play', () => {
    usePlayer.setState({ playing: true });
    setMediaSessionPlaying(true);
  });
  el.addEventListener('pause', () => {
    usePlayer.setState({ playing: false });
    setMediaSessionPlaying(false);
    flushCurrent();
  });
  el.addEventListener('ended', () => {
    if (loadedId) saver.flush(loadedId, el.duration, el.duration);
    advance(true);
  });
  el.addEventListener('error', () => {
    if (!hasSource(el)) return;
    notify('player.mediaError');
    skipBroken();
  });
  audio = el;
  return el;
}

function stopAndClear(el: HTMLAudioElement): void {
  cancelPendingSeek(el);
  el.pause();
  el.removeAttribute('src');
  el.load();
  loadedId = null;
  clearMediaSession();
}

function skipBroken(): void {
  skips += 1;
  if (skips >= usePlayer.getState().order.length) {
    skips = 0;
    stopAndClear(audioElement());
    usePlayer.setState({ playing: false, currentTime: 0 });
    return;
  }
  advance(false);
}

function load(autoplay: boolean): void {
  const el = audioElement();
  cancelPendingSeek(el);
  const id = currentId();
  if (!id) {
    stopAndClear(el);
    return;
  }
  const item = findItem(id);
  if (!item || item.missing) {
    notify('player.missing');
    skipBroken();
    return;
  }
  const start = resumeStart(item.progress, item.durationSec);
  el.src = mediaUrl(id);
  loadedId = id;
  if (start > 0) {
    const seek = () => {
      pendingSeek = null;
      el.currentTime = start;
    };
    pendingSeek = seek;
    el.addEventListener('loadedmetadata', seek, { once: true });
  }
  usePlayer.setState({ currentTime: start, duration: item.durationSec });
  updateMediaSession(item, sessionHandlers);
  void window.downtube.library.markPlayed(id);
  if (autoplay) void el.play().catch(() => undefined);
}

function advance(auto: boolean): void {
  const state = usePlayer.getState();
  const el = audioElement();
  const index = nextIndex(state.order.length, state.index, state.repeat, auto);
  if (index === null) {
    stopAndClear(el);
    usePlayer.setState({ playing: false, currentTime: 0 });
    return;
  }
  if (index === state.index) {
    el.currentTime = 0;
    void el.play().catch(() => undefined);
    return;
  }
  usePlayer.setState({ index });
  load(true);
}

export const usePlayer = create<PlayerState>()((set, get) => ({
  source: [],
  order: [],
  index: 0,
  shuffle: false,
  repeat: 'off',
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 0.9,
  muted: false,
  queueOpen: false,

  playItems: (ids, startIndex = 0, options) => {
    if (ids.length === 0) return;
    flushCurrent();
    skips = 0;
    const clamped = Math.min(Math.max(startIndex, 0), ids.length - 1);
    const shuffle = options?.shuffle ?? get().shuffle;
    const firstId = options?.shuffle ? undefined : ids[clamped];
    set({ source: [...ids], order: shuffle ? shuffleOrder(ids, firstId) : [...ids], index: shuffle ? 0 : clamped, shuffle });
    load(true);
  },

  enqueue: (ids) => {
    const state = get();
    const fresh = ids.filter((id) => !state.order.includes(id));
    if (fresh.length === 0) return;
    if (state.order.length === 0) {
      get().playItems(fresh);
      return;
    }
    set({ source: [...state.source, ...fresh], order: [...state.order, ...fresh] });
  },

  jumpTo: (index) => {
    if (index < 0 || index >= get().order.length) return;
    flushCurrent();
    skips = 0;
    set({ index });
    load(true);
  },

  toggle: () => {
    const el = audioElement();
    if (!hasSource(el)) {
      if (get().order.length > 0) load(true);
      return;
    }
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  },

  play: () => {
    const el = audioElement();
    if (hasSource(el)) void el.play().catch(() => undefined);
  },

  pause: () => {
    audio?.pause();
  },

  next: () => {
    flushCurrent();
    advance(false);
  },

  previous: () => {
    const el = audioElement();
    if (el.currentTime > 3) {
      el.currentTime = 0;
      return;
    }
    flushCurrent();
    const state = get();
    set({ index: prevIndex(state.order.length, state.index, state.repeat) });
    load(true);
  },

  seek: (time) => {
    if (!Number.isFinite(time)) return;
    const target = Math.max(0, time);
    audioElement().currentTime = target;
    // Without this the controlled slider jumps back to the old time until the next timeupdate.
    set({ currentTime: target });
  },

  setVolume: (volume) => {
    const value = Math.min(1, Math.max(0, volume));
    const el = audioElement();
    el.volume = value;
    el.muted = false;
    set({ volume: value, muted: false });
  },

  toggleMute: () => {
    const muted = !get().muted;
    audioElement().muted = muted;
    set({ muted });
  },

  toggleShuffle: () => {
    const state = get();
    const id = state.order[state.index];
    if (!state.shuffle) set({ shuffle: true, order: shuffleOrder(state.source, id), index: 0 });
    else set({ shuffle: false, order: [...state.source], index: id ? Math.max(0, state.source.indexOf(id)) : 0 });
  },

  cycleRepeat: () => set((state) => ({ repeat: state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off' })),

  removeAt: (at) => {
    const state = get();
    const removedId = state.order[at];
    if (removedId === undefined) return;
    const wasCurrent = at === state.index;
    if (wasCurrent) flushCurrent();
    const next = removeFromOrder(state.order, state.index, at);
    if (next.order.length === 0) {
      get().clear();
      return;
    }
    set({ order: next.order, index: next.index, source: state.source.filter((id) => id !== removedId) });
    if (wasCurrent) load(state.playing);
  },

  move: (at, direction) => {
    const state = get();
    const next = moveInOrder(state.order, state.index, at, direction);
    set({ order: next.order, index: next.index, source: state.shuffle ? state.source : next.order });
  },

  clear: () => {
    flushCurrent();
    stopAndClear(audioElement());
    set({ source: [], order: [], index: 0, playing: false, currentTime: 0, duration: 0, queueOpen: false });
  },

  setQueueOpen: (queueOpen) => set({ queueOpen }),
}));
