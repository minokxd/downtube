import { classifySpotifyUrl } from '@shared/spotify-url';
import type { SpotifyList } from '@shared/types';
import type { FetchInit, FetchLike } from '../engine/download';
import { YtdlpError } from '../ytdlp/errors';
import { parseEmbedPage, parsePlaylistPage, type PlaylistPage } from './parse';

export const SPOTIFY_PAGE_SIZE = 100;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const API_URL = 'https://api-partner.spotify.com/pathfinder/v2/query';
// The web player's stored "fetchPlaylist" query. If Spotify retires it, playlists fall back to the embed page.
const PLAYLIST_QUERY = '19ff1327c29e99c208c86d7a9d8f1929cfdf3d3202a0ff4253c821f1901aa94d';
const TIMEOUT_MS = 20_000;

/**
 * Reads songs, albums and playlists from Spotify's public embed pages, which need no account.
 * Playlists are paged through Spotify's web API with the embed player's anonymous token, which
 * also gives each song its album and cover; the embed page alone stops at 100 songs.
 */
export class SpotifyClient {
  constructor(private readonly fetchImpl: FetchLike) {}

  async probe(url: string, start = 1): Promise<SpotifyList> {
    const info = classifySpotifyUrl(url);
    if (!info) throw new YtdlpError('INVALID_URL');
    const html = await (await this.request(`https://open.spotify.com/embed/${info.kind}/${info.id}`)).text();
    const page = parseEmbedPage(html, info.kind);
    const list: SpotifyList = {
      kind: info.kind,
      id: info.id,
      title: page.title || info.id,
      tracks: page.tracks,
      totalCount: page.tracks.length,
      hasMore: false,
      nextStart: page.tracks.length + 1,
      sourceUrl: info.url,
    };
    if (page.owner) list.owner = page.owner;
    if (page.coverUrl) list.coverUrl = page.coverUrl;
    if (info.kind !== 'playlist') return list;

    const offset = start - 1;
    let api: PlaylistPage;
    try {
      if (!page.token) throw new YtdlpError('UNKNOWN', 'spotify: the embed page has no token');
      api = await this.playlistPage(info.id, offset, page.token);
    } catch (err) {
      // The first page can still come from the embed page; later ones cannot.
      if (start > 1) throw err;
      console.warn('[spotify] playlist API failed, using the embed page', err);
      delete list.totalCount;
      if (page.tracks.length >= SPOTIFY_PAGE_SIZE) list.partial = true;
      return list;
    }
    list.tracks = api.tracks;
    list.nextStart = start + SPOTIFY_PAGE_SIZE;
    if (api.totalCount !== undefined) list.totalCount = api.totalCount;
    else delete list.totalCount;
    list.hasMore = api.totalCount !== undefined ? offset + api.itemCount < api.totalCount : api.itemCount >= SPOTIFY_PAGE_SIZE;
    return list;
  }

  private async playlistPage(id: string, offset: number, token: string): Promise<PlaylistPage> {
    const body = JSON.stringify({
      variables: { uri: `spotify:playlist:${id}`, offset, limit: SPOTIFY_PAGE_SIZE },
      operationName: 'fetchPlaylist',
      extensions: { persistedQuery: { version: 1, sha256Hash: PLAYLIST_QUERY } },
    });
    const response = await this.request(API_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json;charset=UTF-8' },
      body,
    });
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new YtdlpError('UNKNOWN', 'spotify: unreadable playlist answer');
    }
    return parsePlaylistPage(json);
  }

  private async request(url: string, init: FetchInit = {}): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        ...init,
        headers: { 'user-agent': USER_AGENT, 'accept-language': 'en', ...init.headers },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new YtdlpError('NETWORK', `spotify: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (response.status === 404) throw new YtdlpError('UNAVAILABLE', `spotify: HTTP 404 for ${url}`);
    if (!response.ok) throw new YtdlpError(response.status === 429 ? 'NETWORK' : 'UNKNOWN', `spotify: HTTP ${response.status} for ${url}`);
    return response;
  }
}
