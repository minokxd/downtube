import type { LibraryItem } from '@shared/types';
import { thumbUrl } from '../lib/media-url';

export interface SessionHandlers {
  play(): void;
  pause(): void;
  next(): void;
  previous(): void;
  seek(time: number): void;
}

const supported = (): boolean => 'mediaSession' in navigator;

export function updateMediaSession(item: LibraryItem, handlers: SessionHandlers): void {
  if (!supported()) return;
  const session = navigator.mediaSession;
  session.metadata = new MediaMetadata({
    title: item.title,
    artist: item.artist ?? item.channel,
    album: 'Downtube',
    artwork: item.thumbPath ? [{ src: thumbUrl(item.id), sizes: '512x512', type: 'image/jpeg' }] : [],
  });
  session.setActionHandler('play', () => handlers.play());
  session.setActionHandler('pause', () => handlers.pause());
  session.setActionHandler('nexttrack', () => handlers.next());
  session.setActionHandler('previoustrack', () => handlers.previous());
  session.setActionHandler('seekto', (details) => {
    if (details.seekTime !== undefined) handlers.seek(details.seekTime);
  });
}

export function setMediaSessionPlaying(playing: boolean): void {
  if (supported()) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
}

export function clearMediaSession(): void {
  if (!supported()) return;
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = 'none';
}
