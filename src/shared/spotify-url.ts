import { classifyUrl } from './youtube-url';

export type SpotifyKind = 'track' | 'album' | 'playlist';

export interface SpotifyUrlInfo {
  kind: SpotifyKind;
  id: string;
  url: string;
}

const HOSTS = new Set(['open.spotify.com', 'play.spotify.com']);
const KINDS: readonly SpotifyKind[] = ['track', 'album', 'playlist'];
export const SPOTIFY_ID_RE = /^[A-Za-z0-9]{22}$/;

export const spotifyUrl = (kind: SpotifyKind, id: string): string => `https://open.spotify.com/${kind}/${id}`;

const isKind = (value: string | undefined): value is SpotifyKind => KINDS.includes(value as SpotifyKind);

function info(kind: string | undefined, id: string | undefined): SpotifyUrlInfo | null {
  return isKind(kind) && id !== undefined && SPOTIFY_ID_RE.test(id) ? { kind, id, url: spotifyUrl(kind, id) } : null;
}

/** A Spotify song, album or playlist link (or a spotify: URI); null for anything else. */
export function classifySpotifyUrl(input: string): SpotifyUrlInfo | null {
  const text = input.trim();
  if (text.length === 0 || text.length > 2048 || /\s/.test(text)) return null;
  if (/^spotify:/i.test(text)) {
    const parts = text.split(':');
    return info(parts.at(-2), parts.at(-1));
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;
  // Covers /track/ID, /intl-tr/track/ID, /embed/album/ID and the old /user/NAME/playlist/ID.
  const parts = url.pathname.split('/').filter(Boolean);
  const at = parts.findLastIndex((part) => isKind(part));
  return at < 0 ? null : info(parts[at], parts[at + 1]);
}

/** The canonical form of a YouTube or Spotify link, or null when it is neither. */
export function canonicalLink(input: string): string | null {
  const youtube = classifyUrl(input);
  if (youtube.kind !== 'invalid') return youtube.url;
  return classifySpotifyUrl(input)?.url ?? null;
}

export const isSupportedLink = (input: string): boolean => canonicalLink(input) !== null;
