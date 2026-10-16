import type { SpotifyKind, SpotifyTrack } from '@shared/types';
import { SPOTIFY_ID_RE } from '@shared/spotify-url';
import { YtdlpError } from '../ytdlp/errors';

type Json = Record<string, unknown>;

const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined);
const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const asObject = (value: unknown): Json => (typeof value === 'object' && value !== null ? (value as Json) : {});
const asArray = (value: unknown): Json[] => (Array.isArray(value) ? value.map(asObject) : []);
const path = (value: unknown, ...keys: string[]): unknown => keys.reduce<unknown>((at, key) => asObject(at)[key], value);

/** The id in "spotify:track:<id>", or undefined for episodes, local files and anything else. */
function trackId(uri: unknown): string | undefined {
  const match = /^spotify:track:([A-Za-z0-9]+)$/.exec(str(uri) ?? '');
  return match?.[1] !== undefined && SPOTIFY_ID_RE.test(match[1]) ? match[1] : undefined;
}

const seconds = (ms: unknown): number | undefined => {
  const value = num(ms);
  return value !== undefined && value > 0 ? Math.round(value / 1000) : undefined;
};

/** The largest image of a Spotify image list (`url` with `width` or `maxWidth`). */
export function largestImage(images: unknown): string | undefined {
  let best: { url: string; width: number } | undefined;
  for (const image of asArray(images)) {
    const url = str(image.url);
    if (!url?.startsWith('https://')) continue;
    const width = num(image.width) ?? num(image.maxWidth) ?? 0;
    if (!best || width > best.width) best = { url, width };
  }
  return best?.url;
}

const joinNames = (artists: unknown, ...nameKeys: string[]): string | undefined => {
  const names = asArray(artists)
    .map((artist) => str(path(artist, ...nameKeys)))
    .filter((name): name is string => name !== undefined);
  return names.length > 0 ? names.join(', ') : undefined;
};

export interface EmbedPage {
  title: string;
  owner?: string;
  coverUrl?: string;
  tracks: SpotifyTrack[];
  /** Anonymous token of the embed player, for Spotify's web API. */
  token?: string;
}

const NEXT_DATA = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;

/** Reads the data of an open.spotify.com/embed/... page. */
export function parseEmbedPage(html: string, kind: SpotifyKind): EmbedPage {
  const match = NEXT_DATA.exec(html);
  if (!match?.[1]) throw new YtdlpError('UNKNOWN', 'spotify: no page data in the embed page');
  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    throw new YtdlpError('UNKNOWN', 'spotify: unreadable page data');
  }
  const state = path(data, 'props', 'pageProps', 'state');
  const entity = asObject(path(state, 'data', 'entity'));
  // A removed or private item still answers 200, with an error page and no entity.
  if (str(entity.type) !== kind) throw new YtdlpError('UNAVAILABLE', `spotify: no ${kind} on the embed page`);
  const title = str(entity.name) ?? str(entity.title) ?? '';
  const coverUrl = largestImage(path(entity, 'coverArt', 'sources')) ?? largestImage(path(entity, 'visualIdentity', 'image'));
  const token = str(path(state, 'settings', 'session', 'accessToken'));
  const page = (owner: string | undefined, tracks: SpotifyTrack[]): EmbedPage => ({
    title,
    ...(owner !== undefined && { owner }),
    ...(coverUrl !== undefined && { coverUrl }),
    tracks,
    ...(token !== undefined && { token }),
  });

  if (kind === 'track') {
    const id = str(entity.id) ?? trackId(entity.uri);
    const artist = joinNames(entity.artists, 'name') ?? str(entity.subtitle) ?? '';
    if (!id || !SPOTIFY_ID_RE.test(id)) throw new YtdlpError('UNAVAILABLE', 'spotify: song without id');
    const track: SpotifyTrack = { id, title: title || id, artist };
    const durationSec = seconds(entity.duration);
    if (durationSec !== undefined) track.durationSec = durationSec;
    if (coverUrl) track.coverUrl = coverUrl;
    return page(artist || undefined, [track]);
  }

  const owner = str(entity.subtitle);
  const tracks: SpotifyTrack[] = [];
  asArray(entity.trackList).forEach((entry, index) => {
    const id = trackId(entry.uri);
    const name = str(entry.title);
    if (!id || !name) return;
    const track: SpotifyTrack = { id, title: name, artist: str(entry.subtitle) ?? owner ?? '' };
    const durationSec = seconds(entry.duration);
    if (durationSec !== undefined) track.durationSec = durationSec;
    // On an album page every song shares the album, its artist and cover; a playlist page has no album data.
    if (kind === 'album') {
      if (title) track.album = title;
      if (owner) track.albumArtist = owner;
      if (coverUrl) track.coverUrl = coverUrl;
      track.trackNumber = index + 1;
    }
    tracks.push(track);
  });
  return page(owner, tracks);
}

export interface PlaylistPage {
  tracks: SpotifyTrack[];
  /** Items on this page before episodes and local files were dropped. */
  itemCount: number;
  totalCount?: number;
}

/** Reads a "fetchPlaylist" answer of Spotify's web API. */
export function parsePlaylistPage(raw: unknown): PlaylistPage {
  const playlist = asObject(path(raw, 'data', 'playlistV2'));
  if (str(playlist.__typename) !== 'Playlist') throw new YtdlpError('UNAVAILABLE', 'spotify: playlist not found');
  const content = asObject(playlist.content);
  const items = asArray(content.items);
  const tracks: SpotifyTrack[] = [];
  for (const item of items) {
    const data = asObject(path(item, 'itemV2', 'data'));
    const id = trackId(data.uri);
    const title = str(data.name);
    if (!id || !title) continue;
    const album = asObject(data.albumOfTrack);
    const track: SpotifyTrack = { id, title, artist: joinNames(path(data, 'artists', 'items'), 'profile', 'name') ?? '' };
    const albumName = str(album.name);
    const albumArtist = joinNames(path(album, 'artists', 'items'), 'profile', 'name');
    const durationSec = seconds(path(data, 'trackDuration', 'totalMilliseconds'));
    const coverUrl = largestImage(path(album, 'coverArt', 'sources'));
    const trackNumber = num(data.trackNumber);
    if (albumName) track.album = albumName;
    if (albumArtist) track.albumArtist = albumArtist;
    if (durationSec !== undefined) track.durationSec = durationSec;
    if (coverUrl) track.coverUrl = coverUrl;
    if (trackNumber !== undefined && trackNumber > 0) track.trackNumber = trackNumber;
    tracks.push(track);
  }
  const totalCount = num(content.totalCount);
  return { tracks, itemCount: items.length, ...(totalCount !== undefined && { totalCount }) };
}
