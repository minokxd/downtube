import { SPOTIFY_ID_RE } from './spotify-url';
import type { SpotifyTrack } from './types';

const text = (value: unknown, max = 500): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max ? value.trim() : undefined;

/** Only Spotify's own image servers, since the main process downloads the cover. */
export function isSpotifyImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && (host === 'i.scdn.co' || host.endsWith('.scdn.co') || host.endsWith('.spotifycdn.com'));
  } catch {
    return false;
  }
}

/** A well-formed copy of a Spotify song's data, or null. Unknown or broken optional fields are dropped. */
export function cleanSpotifyTrack(value: unknown): SpotifyTrack | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const title = text(v.title);
  if (typeof v.id !== 'string' || !SPOTIFY_ID_RE.test(v.id) || !title || typeof v.artist !== 'string' || v.artist.length > 500) {
    return null;
  }
  const track: SpotifyTrack = { id: v.id, title, artist: v.artist.trim() };
  const album = text(v.album);
  const albumArtist = text(v.albumArtist);
  if (album) track.album = album;
  if (albumArtist) track.albumArtist = albumArtist;
  if (typeof v.durationSec === 'number' && Number.isFinite(v.durationSec) && v.durationSec > 0 && v.durationSec < 1_000_000) {
    track.durationSec = v.durationSec;
  }
  if (isSpotifyImageUrl(v.coverUrl)) track.coverUrl = v.coverUrl;
  if (typeof v.trackNumber === 'number' && Number.isInteger(v.trackNumber) && v.trackNumber > 0 && v.trackNumber < 10_000) {
    track.trackNumber = v.trackNumber;
  }
  return track;
}
