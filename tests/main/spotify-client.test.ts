import { describe, expect, it, vi } from 'vitest';
import type { FetchInit } from '../../src/main/engine/download';
import { SPOTIFY_PAGE_SIZE, SpotifyClient } from '../../src/main/spotify/client';

const PL = '37i9dQZF1DXcBWIGoYBM5M';
const trackId = (n: number): string => `${'A'.repeat(18)}${String(n).padStart(4, '0')}`;

const embed = (entity: unknown, token = 'anon-token'): string =>
  `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { state: { data: { entity }, settings: { session: { accessToken: token } } } } },
  })}</script>`;

const embedPlaylist = (count: number) =>
  embed({
    type: 'playlist',
    name: 'Big list',
    subtitle: 'Someone',
    coverArt: { sources: [{ url: 'https://i.scdn.co/image/pl' }] },
    trackList: Array.from({ length: count }, (_, i) => ({ uri: `spotify:track:${trackId(i)}`, title: `Song ${i}`, subtitle: 'Artist', duration: 180000 })),
  });

const apiPage = (from: number, count: number, total: number) => ({
  data: {
    playlistV2: {
      __typename: 'Playlist',
      content: {
        totalCount: total,
        items: Array.from({ length: count }, (_, i) => ({
          itemV2: { data: { uri: `spotify:track:${trackId(from + i)}`, name: `Song ${from + i}`, artists: { items: [{ profile: { name: 'Artist' } }] } } },
        })),
      },
    },
  },
});

function fakeFetch(handler: (url: string, init?: FetchInit) => Response | Promise<Response>) {
  return vi.fn(async (url: string, init?: FetchInit) => handler(url, init));
}

describe('SpotifyClient', () => {
  it('pages a playlist through the web API with the embed token', async () => {
    const fetchImpl = fakeFetch((url, init) => {
      if (url.startsWith('https://open.spotify.com/embed/playlist/')) return new Response(embedPlaylist(100));
      const body = JSON.parse(init?.body ?? '{}') as { variables: { offset: number; limit: number } };
      return Response.json(apiPage(body.variables.offset, Math.min(body.variables.limit, 250 - body.variables.offset), 250));
    });
    const client = new SpotifyClient(fetchImpl);

    const first = await client.probe(`https://open.spotify.com/playlist/${PL}?si=x`);
    expect(first).toMatchObject({ kind: 'playlist', id: PL, title: 'Big list', owner: 'Someone', totalCount: 250, hasMore: true, nextStart: 101 });
    expect(first.tracks).toHaveLength(SPOTIFY_PAGE_SIZE);
    expect(first.partial).toBeUndefined();
    const call = fetchImpl.mock.calls.find(([url]) => url.includes('pathfinder'));
    expect(call?.[1]?.headers?.authorization).toBe('Bearer anon-token');

    const last = await client.probe(first.sourceUrl, 201);
    expect(last.tracks.map((t) => t.title)).toEqual(Array.from({ length: 50 }, (_, i) => `Song ${200 + i}`));
    expect(last.hasMore).toBe(false);
  });

  it('falls back to the embed page when the web API fails, and says the list may be cut', async () => {
    const fetchImpl = fakeFetch((url) => (url.includes('pathfinder') ? new Response('', { status: 400 }) : new Response(embedPlaylist(100))));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const list = await new SpotifyClient(fetchImpl).probe(`spotify:playlist:${PL}`);
    warn.mockRestore();
    expect(list).toMatchObject({ hasMore: false, partial: true });
    expect(list.tracks).toHaveLength(100);
    expect(list.totalCount).toBeUndefined();
    await expect(new SpotifyClient(fetchImpl).probe(`spotify:playlist:${PL}`, 101)).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  it('reads an album from its embed page alone', async () => {
    const fetchImpl = fakeFetch(() =>
      new Response(
        embed({
          type: 'album',
          name: 'Album',
          subtitle: 'Band',
          trackList: [{ uri: `spotify:track:${trackId(1)}`, title: 'One', subtitle: 'Band', duration: 1000 }],
        }),
      ),
    );
    const list = await new SpotifyClient(fetchImpl).probe(`https://open.spotify.com/album/${PL}`);
    expect(list).toMatchObject({ kind: 'album', title: 'Album', totalCount: 1, hasMore: false });
    expect(list.tracks[0]).toMatchObject({ title: 'One', album: 'Album', trackNumber: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps failures to error codes', async () => {
    const offline = fakeFetch(() => Promise.reject(new TypeError('fetch failed')));
    await expect(new SpotifyClient(offline).probe(`spotify:track:${PL}`)).rejects.toMatchObject({ code: 'NETWORK' });
    const missing = fakeFetch(() => new Response('', { status: 404 }));
    await expect(new SpotifyClient(missing).probe(`spotify:track:${PL}`)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    await expect(new SpotifyClient(missing).probe('https://example.com')).rejects.toMatchObject({ code: 'INVALID_URL' });
  });
});
