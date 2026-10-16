import { describe, expect, it } from 'vitest';
import { cleanSpotifyTrack, isSpotifyImageUrl } from '../../src/shared/spotify-track';
import { canonicalLink, classifySpotifyUrl, isSupportedLink } from '../../src/shared/spotify-url';

const ID = '3XmwAZpIMNpTJy8faw3ajD';

describe('classifySpotifyUrl', () => {
  it.each([
    [`https://open.spotify.com/track/${ID}`, 'track'],
    [`https://open.spotify.com/track/${ID}?si=abc123`, 'track'],
    [`open.spotify.com/album/${ID}`, 'album'],
    [`https://open.spotify.com/intl-tr/playlist/${ID}?si=x`, 'playlist'],
    [`https://open.spotify.com/embed/playlist/${ID}`, 'playlist'],
    [`https://open.spotify.com/user/someone/playlist/${ID}`, 'playlist'],
    [`https://play.spotify.com/album/${ID}`, 'album'],
    [`spotify:track:${ID}`, 'track'],
    [`spotify:user:someone:playlist:${ID}`, 'playlist'],
  ])('reads %s', (input, kind) => {
    expect(classifySpotifyUrl(input)).toEqual({ kind, id: ID, url: `https://open.spotify.com/${kind}/${ID}` });
  });

  it.each([
    '',
    'hello',
    `https://open.spotify.com/artist/${ID}`,
    `https://open.spotify.com/episode/${ID}`,
    'https://open.spotify.com/track/short',
    `https://evil.example/track/${ID}`,
    `https://open.spotify.com.evil.example/track/${ID}`,
    `ftp://open.spotify.com/track/${ID}`,
    `spotify:artist:${ID}`,
    `https://open.spotify.com/track/${ID} extra`,
  ])('rejects %j', (input) => {
    expect(classifySpotifyUrl(input)).toBeNull();
  });
});

describe('canonicalLink', () => {
  it('gives the canonical YouTube or Spotify link', () => {
    expect(canonicalLink('https://youtu.be/jNQXAC9IVRw')).toBe('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    expect(canonicalLink(` https://open.spotify.com/track/${ID}?si=1 `)).toBe(`https://open.spotify.com/track/${ID}`);
    expect(canonicalLink('https://vimeo.com/1')).toBeNull();
  });

  it('tells supported links apart', () => {
    expect(isSupportedLink(`spotify:album:${ID}`)).toBe(true);
    expect(isSupportedLink('https://www.youtube.com/@channel')).toBe(true);
    expect(isSupportedLink('https://soundcloud.com/a/b')).toBe(false);
  });
});

describe('cleanSpotifyTrack', () => {
  const track = {
    id: ID,
    title: ' expectations ',
    artist: 'Olivia Rodrigo, Chappell Roan',
    album: 'expectations',
    durationSec: 224,
    coverUrl: 'https://i.scdn.co/image/ab67616d0000b273',
    trackNumber: 1,
  };

  it('keeps a valid song', () => {
    expect(cleanSpotifyTrack(track)).toEqual({ ...track, title: 'expectations' });
  });

  it('drops broken optional fields', () => {
    expect(cleanSpotifyTrack({ ...track, coverUrl: 'https://evil.example/a.jpg', trackNumber: 1.5, durationSec: -1, album: '' })).toEqual({
      id: ID,
      title: 'expectations',
      artist: 'Olivia Rodrigo, Chappell Roan',
    });
  });

  it('rejects a song without a valid id, title or artist', () => {
    expect(cleanSpotifyTrack({ ...track, id: 'x' })).toBeNull();
    expect(cleanSpotifyTrack({ ...track, title: ' ' })).toBeNull();
    expect(cleanSpotifyTrack({ ...track, artist: 3 })).toBeNull();
    expect(cleanSpotifyTrack(null)).toBeNull();
  });

  it('accepts only Spotify image hosts', () => {
    expect(isSpotifyImageUrl('https://image-cdn-fa.spotifycdn.com/image/ab')).toBe(true);
    expect(isSpotifyImageUrl('https://mosaic.scdn.co/640/ab')).toBe(true);
    expect(isSpotifyImageUrl('http://i.scdn.co/image/ab')).toBe(false);
    expect(isSpotifyImageUrl('https://scdn.co.evil.example/image')).toBe(false);
  });
});
