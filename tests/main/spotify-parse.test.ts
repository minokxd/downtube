import { describe, expect, it } from 'vitest';
import { largestImage, parseEmbedPage, parsePlaylistPage } from '../../src/main/spotify/parse';
import { YtdlpError } from '../../src/main/ytdlp/errors';

const T1 = '6OmhkSOpvYBokMKQxpIGx2';
const T2 = '2iblMMIgSznA464mNov7A8';

const page = (state: unknown): string =>
  `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { state } } })}</script></body></html>`;

const images = [
  { url: 'https://image-cdn-fa.spotifycdn.com/image/300', maxWidth: 300 },
  { url: 'https://image-cdn-fa.spotifycdn.com/image/640', maxWidth: 640 },
  { url: 'https://image-cdn-fa.spotifycdn.com/image/64', maxWidth: 64 },
];
const session = { session: { accessToken: 'token-1', isAnonymous: true } };

describe('parseEmbedPage', () => {
  it('reads an album with its songs, cover and token', () => {
    const html = page({
      data: {
        entity: {
          type: 'album',
          name: 'Global Warming',
          subtitle: 'Pitbull',
          visualIdentity: { image: images },
          trackList: [
            { uri: `spotify:track:${T1}`, title: 'Global Warming (feat. Sensato)', subtitle: 'Pitbull, Sensato', duration: 85400 },
            { uri: 'spotify:episode:abc', title: 'An episode', subtitle: 'Someone', duration: 1000 },
            { uri: `spotify:track:${T2}`, title: "Don't Stop the Party (feat. TJR)", subtitle: 'Pitbull, TJR', duration: 206120 },
          ],
        },
      },
      settings: session,
    });
    expect(parseEmbedPage(html, 'album')).toEqual({
      title: 'Global Warming',
      owner: 'Pitbull',
      coverUrl: 'https://image-cdn-fa.spotifycdn.com/image/640',
      token: 'token-1',
      tracks: [
        {
          id: T1,
          title: 'Global Warming (feat. Sensato)',
          artist: 'Pitbull, Sensato',
          album: 'Global Warming',
          albumArtist: 'Pitbull',
          durationSec: 85,
          coverUrl: 'https://image-cdn-fa.spotifycdn.com/image/640',
          trackNumber: 1,
        },
        {
          id: T2,
          title: "Don't Stop the Party (feat. TJR)",
          artist: 'Pitbull, TJR',
          album: 'Global Warming',
          albumArtist: 'Pitbull',
          durationSec: 206,
          coverUrl: 'https://image-cdn-fa.spotifycdn.com/image/640',
          trackNumber: 3,
        },
      ],
    });
  });

  it('reads a playlist, whose songs have no album data', () => {
    const html = page({
      data: {
        entity: {
          type: 'playlist',
          name: 'Top Hits',
          subtitle: 'Spotify',
          coverArt: { sources: [{ url: 'https://i.scdn.co/image/pl', width: null }] },
          trackList: [{ uri: `spotify:track:${T1}`, title: 'Song', subtitle: 'Artist', duration: 200000 }],
        },
      },
      settings: session,
    });
    const result = parseEmbedPage(html, 'playlist');
    expect(result.coverUrl).toBe('https://i.scdn.co/image/pl');
    expect(result.tracks).toEqual([{ id: T1, title: 'Song', artist: 'Artist', durationSec: 200 }]);
  });

  it('reads a single song with all its artists', () => {
    const html = page({
      data: {
        entity: {
          type: 'track',
          id: T1,
          name: 'expectations (feat. Chappell Roan)',
          artists: [{ name: 'Olivia Rodrigo' }, { name: 'Chappell Roan' }],
          duration: 223935,
          visualIdentity: { image: images },
        },
      },
      settings: session,
    });
    expect(parseEmbedPage(html, 'track').tracks).toEqual([
      {
        id: T1,
        title: 'expectations (feat. Chappell Roan)',
        artist: 'Olivia Rodrigo, Chappell Roan',
        durationSec: 224,
        coverUrl: 'https://image-cdn-fa.spotifycdn.com/image/640',
      },
    ]);
  });

  it('reports a removed item as unavailable', () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { status: 500 } } })}</script>`;
    expect(() => parseEmbedPage(html, 'playlist')).toThrow(expect.objectContaining({ code: 'UNAVAILABLE' }));
  });

  it('reports a page without data', () => {
    expect(() => parseEmbedPage('<html></html>', 'album')).toThrow(YtdlpError);
  });
});

describe('parsePlaylistPage', () => {
  const item = (uri: string, name: string) => ({
    itemV2: {
      data: {
        __typename: 'Track',
        uri,
        name,
        artists: { items: [{ profile: { name: 'Olivia Rodrigo' } }, { profile: { name: 'Chappell Roan' } }] },
        albumOfTrack: {
          name: 'GUTS',
          artists: { items: [{ profile: { name: 'Olivia Rodrigo' } }] },
          coverArt: { sources: [{ url: 'https://i.scdn.co/image/64', width: 64 }, { url: 'https://i.scdn.co/image/640', width: 640 }] },
        },
        trackDuration: { totalMilliseconds: 223935 },
        trackNumber: 4,
      },
    },
  });

  it('reads songs with album, cover and track number, skipping episodes', () => {
    const raw = {
      data: {
        playlistV2: {
          __typename: 'Playlist',
          content: { totalCount: 250, items: [item(`spotify:track:${T1}`, 'expectations'), item('spotify:episode:x', 'Episode')] },
        },
      },
    };
    expect(parsePlaylistPage(raw)).toEqual({
      itemCount: 2,
      totalCount: 250,
      tracks: [
        {
          id: T1,
          title: 'expectations',
          artist: 'Olivia Rodrigo, Chappell Roan',
          album: 'GUTS',
          albumArtist: 'Olivia Rodrigo',
          durationSec: 224,
          coverUrl: 'https://i.scdn.co/image/640',
          trackNumber: 4,
        },
      ],
    });
  });

  it('reports a missing playlist', () => {
    expect(() => parsePlaylistPage({ data: { playlistV2: { __typename: 'NotFound' } } })).toThrow(
      expect.objectContaining({ code: 'UNAVAILABLE' }),
    );
  });
});

describe('largestImage', () => {
  it('picks the widest https image', () => {
    expect(largestImage(images)).toBe('https://image-cdn-fa.spotifycdn.com/image/640');
    expect(largestImage([{ url: 'http://i.scdn.co/a', width: 999 }])).toBeUndefined();
    expect(largestImage(undefined)).toBeUndefined();
  });
});
