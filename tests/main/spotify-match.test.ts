import { describe, expect, it } from 'vitest';
import type { SpotifyTrack } from '@shared/types';
import { baseTitle, musicSearchUrl, parseSearch, pickMatch, searchText, videoSearchUrl } from '../../src/main/spotify/match';

const song = (title: string, artist: string, durationSec?: number): SpotifyTrack => ({
  id: '6OmhkSOpvYBokMKQxpIGx2',
  title,
  artist,
  ...(durationSec !== undefined && { durationSec }),
});

describe('search text', () => {
  it.each([
    ['Global Warming (feat. Sensato)', 'Global Warming'],
    ['expectations (with Chappell Roan)', 'expectations'],
    ['Song [ft. Someone]', 'Song'],
    ['Here Comes the Sun - Remastered 2009', 'Here Comes the Sun'],
    ['Song - feat. Someone', 'Song'],
    ['Song (Live)', 'Song (Live)'],
    ['(feat. only)', '(feat. only)'],
  ])('base title of %j is %j', (title, base) => {
    expect(baseTitle(title)).toBe(base);
  });

  it('searches with the artists and the base title', () => {
    const track = song('Global Warming (feat. Sensato)', 'Pitbull, Sensato');
    expect(searchText(track)).toBe('Pitbull, Sensato Global Warming');
    expect(musicSearchUrl(track)).toBe('https://music.youtube.com/search?q=Pitbull%2C%20Sensato%20Global%20Warming#songs');
    expect(videoSearchUrl(track)).toBe('ytsearch5:Pitbull, Sensato Global Warming');
  });
});

describe('pickMatch', () => {
  it('prefers the official song over a matching video', () => {
    const track = song('Global Warming (feat. Sensato)', 'Pitbull, Sensato', 85);
    const hit = pickMatch(track, {
      songs: [
        { id: '9ohd3dSydY8', title: 'Global Warming (feat. Sensato)' },
        { id: '5LvZjov7QWg', title: 'Day Drinking (feat. Heymous Molly)' },
      ],
      videos: [
        { id: 'q7xBoh0emqo', title: 'Pitbull - Global Warming (The Global Warming Listening Party) ft. Sensato', channel: 'Pitbull', durationSec: 85 },
        { id: '9ohd3dSydY8', title: 'Global Warming', channel: 'Pitbull', durationSec: 86 },
      ],
    });
    expect(hit?.id).toBe('9ohd3dSydY8');
  });

  it('matches Turkish titles written with or without special letters', () => {
    const track = song('Şımarık', 'Tarkan', 193);
    expect(pickMatch(track, { songs: [{ id: 'JJPlzNajdUs', title: 'Simarik' }], videos: [] })?.id).toBe('JJPlzNajdUs');
  });

  it('skips song results with another title', () => {
    const track = song('Firuze', 'Sezen Aksu', 305);
    const hit = pickMatch(track, {
      songs: [
        { id: 'gHYhVQhYEVI', title: 'Konna Netlaka' },
        { id: 'DFkjyxLmc74', title: 'Firuze' },
      ],
      videos: [],
    });
    expect(hit?.id).toBe('DFkjyxLmc74');
  });

  it('avoids karaoke and live versions the Spotify title does not ask for', () => {
    const track = song('Firuze', 'Sezen Aksu', 305);
    const hit = pickMatch(track, {
      songs: [
        { id: 'aaaaaaaaaaa', title: 'Firuze (Karaoke Version)' },
        { id: 'bbbbbbbbbbb', title: 'Firuze' },
      ],
      videos: [],
    });
    expect(hit?.id).toBe('bbbbbbbbbbb');
  });

  it('rather finds nothing than a karaoke remake', () => {
    const track = song('Firuze', 'Sezen Aksu', 305);
    const results = {
      songs: [{ id: 'aaaaaaaaaaa', title: 'Firuze (Karaoke Version)' }],
      videos: [{ id: 'bbbbbbbbbbb', title: 'Sezen Aksu - Firuze (Instrumental)', channel: 'Sezen Aksu', durationSec: 305 }],
    };
    expect(pickMatch(track, results)).toBeUndefined();
    expect(pickMatch(song('Firuze (Instrumental)', 'Sezen Aksu', 305), results)?.id).toBe('bbbbbbbbbbb');
  });

  it('falls back to a video from the artist with the right length', () => {
    const track = song('Firuze', 'Sezen Aksu', 305);
    const hit = pickMatch(track, {
      songs: [],
      videos: [
        { id: 'J_0bSTR9diY', title: 'SEZEN AKSU   FİRUZE  1986', channel: 'Deniz Orallı', durationSec: 86 },
        { id: 'EO4r_SV6bbA', title: 'Sezen Aksu - Firuze (Official Audio - Orijinal Plak Kayıt)', channel: 'Sezen Aksu', durationSec: 305 },
      ],
    });
    expect(hit?.id).toBe('EO4r_SV6bbA');
  });

  it('finds nothing when no result is close enough', () => {
    const track = song('Firuze', 'Sezen Aksu', 305);
    expect(pickMatch(track, { songs: [{ id: 'aaaaaaaaaaa', title: 'Hasret' }], videos: [] })).toBeUndefined();
    expect(
      pickMatch(track, { songs: [], videos: [{ id: 'bbbbbbbbbbb', title: 'Firuze', channel: 'Someone', durationSec: 900 }] }),
    ).toBeUndefined();
    expect(pickMatch(track, { songs: [], videos: [] })).toBeUndefined();
  });
});

describe('parseSearch', () => {
  it('splits the two searches and keeps valid entries', () => {
    const music = {
      extractor_key: 'YoutubeMusicSearchURL',
      entries: [{ id: '9ohd3dSydY8', title: 'Global Warming (feat. Sensato)' }, { id: 'bad', title: 'x' }],
    };
    const videos = {
      extractor_key: 'YoutubeSearch',
      entries: [{ id: 'q7xBoh0emqo', title: 'Pitbull - Global Warming', channel: 'Pitbull', duration: 85 }, { title: 'no id' }],
    };
    const stdout = `${JSON.stringify(music)}\nWARNING: something\n${JSON.stringify(videos)}\n`;
    expect(parseSearch(stdout)).toEqual({
      songs: [{ id: '9ohd3dSydY8', title: 'Global Warming (feat. Sensato)' }],
      videos: [{ id: 'q7xBoh0emqo', title: 'Pitbull - Global Warming', channel: 'Pitbull', durationSec: 85 }],
    });
  });

  it('survives empty or broken output', () => {
    expect(parseSearch('')).toEqual({ songs: [], videos: [] });
    expect(parseSearch('{not json')).toEqual({ songs: [], videos: [] });
  });
});
