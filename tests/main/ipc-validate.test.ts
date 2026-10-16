import { describe, expect, it } from 'vitest';
import {
  IpcValidationError,
  assertBoolean,
  assertId,
  assertIdList,
  assertJobInputs,
  assertLink,
  assertOptionalDuration,
  assertOptionalId,
  assertPlaylistEmoji,
  assertPlaylistPatch,
  assertPlaylistTitle,
  assertPosition,
  assertSettingsPatch,
  assertStart,
  assertTheme,
  assertYoutubeUrl,
} from '../../src/main/ipc-validate';

const job = {
  url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  videoId: 'jNQXAC9IVRw',
  title: 'Me at the zoo',
  thumbnailUrl: 'https://i.ytimg.com/vi/x.jpg',
  kind: 'video',
  quality: '1080',
  subtitles: true,
  collection: { youtubeId: 'PL_x-1', kind: 'playlist', title: 'List', index: 3 },
};

describe('simple assertions', () => {
  it('accept valid values', () => {
    expect(assertId('0f8fad5b-d9cb-469f')).toBe('0f8fad5b-d9cb-469f');
    expect(assertYoutubeUrl('https://youtu.be/jNQXAC9IVRw')).toBe('https://youtu.be/jNQXAC9IVRw');
    expect(assertStart(undefined)).toBe(1);
    expect(assertStart(101)).toBe(101);
    expect(assertPosition(12.5)).toBe(12.5);
    expect(assertOptionalDuration(undefined)).toBeUndefined();
    expect(assertOptionalDuration(30)).toBe(30);
    expect(assertBoolean(false)).toBe(false);
    expect(assertTheme('light')).toBe('light');
  });

  it.each([
    () => assertId('../etc'),
    () => assertId(5),
    () => assertYoutubeUrl('https://example.com'),
    () => assertYoutubeUrl(42),
    () => assertStart(0),
    () => assertStart(1.5),
    () => assertPosition(-1),
    () => assertPosition(Number.NaN),
    () => assertOptionalDuration('x'),
    () => assertBoolean('true'),
    () => assertTheme('system'),
  ])('rejects invalid input %#', (fn) => {
    expect(fn).toThrow(IpcValidationError);
  });
});

describe('assertJobInputs', () => {
  it('copies only known fields', () => {
    const [result] = assertJobInputs([{ ...job, extra: 'dropped' }]);
    expect(result).toEqual(job);
  });

  it('defaults an empty title to the video id', () => {
    expect(assertJobInputs([{ ...job, title: '  ' }])[0]?.title).toBe('jNQXAC9IVRw');
  });

  it.each([
    [[]],
    ['nope'],
    [[{ ...job, videoId: 'short' }]],
    [[{ ...job, url: 'https://example.com' }]],
    [[{ ...job, kind: 'gif' }]],
    [[{ ...job, quality: '4k' }]],
    [[{ ...job, thumbnailUrl: 'http://insecure.example/x.jpg' }]],
    [[{ ...job, collection: { ...job.collection, index: -1 } }]],
    [Array.from({ length: 501 }, () => job)],
    // The url must be a single video that matches videoId, never a playlist or channel.
    [[{ ...job, url: 'https://www.youtube.com/playlist?list=PL_x-1' }]],
    [[{ ...job, url: 'https://www.youtube.com/@jawed' }]],
    [[{ ...job, url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' }]],
  ])('rejects case %#', (value) => {
    expect(() => assertJobInputs(value)).toThrow(IpcValidationError);
  });

  it('normalizes a share link to the canonical watch URL', () => {
    const [result] = assertJobInputs([{ ...job, url: 'https://youtu.be/jNQXAC9IVRw?si=x' }]);
    expect(result?.url).toBe('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    expect(result?.videoId).toBe('jNQXAC9IVRw');
  });

  it('drops the list parameter of a video inside a playlist', () => {
    const [result] = assertJobInputs([{ ...job, url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw&list=PL_x-1&index=3' }]);
    expect(result?.url).toBe('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  });
});

describe('assertSettingsPatch', () => {
  it('passes a plain patch through for SettingsStore to validate', () => {
    const patch = { theme: 'dark' };
    expect(assertSettingsPatch(patch)).toBe(patch);
    expect(assertSettingsPatch({})).toEqual({});
  });

  it.each([
    [{ downloadDir: 'C:\\x' }],
    [{ downloadDir: '\\\\attacker\\share' }],
    [{ theme: 'dark', downloadDir: 'C:\\x' }],
    [{ downloadDir: undefined }],
    [{ lastYtdlpUpdateCheck: '2026-01-01T00:00:00Z' }],
    [{ lastYtdlpUpdateCheck: '9999-01-01' }],
    [null],
    [undefined],
    [[]],
    [[{ theme: 'dark' }]],
    ['theme'],
    [42],
    [new Date()],
  ])('rejects %#', (value) => {
    expect(() => assertSettingsPatch(value)).toThrow(IpcValidationError);
  });
});

describe('playlist assertions', () => {
  it('accepts a trimmed title of 1 to 80 characters', () => {
    expect(assertPlaylistTitle('  Kedi videoları ')).toBe('Kedi videoları');
    expect(assertPlaylistTitle('x'.repeat(80))).toHaveLength(80);
  });

  it.each(['', '   ', 'x'.repeat(81), 'a\nb', 5, null])('rejects the title %j', (value) => {
    expect(() => assertPlaylistTitle(value)).toThrow(IpcValidationError);
  });

  it('accepts only listed emoji or nothing', () => {
    expect(assertPlaylistEmoji(undefined)).toBeUndefined();
    expect(assertPlaylistEmoji('🐱')).toBe('🐱');
    expect(() => assertPlaylistEmoji('🦄')).toThrow(IpcValidationError);
    expect(() => assertPlaylistEmoji('<b>')).toThrow(IpcValidationError);
  });

  it('accepts a title/emoji patch and nothing else', () => {
    expect(assertPlaylistPatch({ title: ' A ', emoji: null })).toEqual({ title: 'A', emoji: null });
    expect(assertPlaylistPatch({ emoji: '🎵' })).toEqual({ emoji: '🎵' });
    expect(() => assertPlaylistPatch({ itemIds: [] })).toThrow(IpcValidationError);
    expect(() => assertPlaylistPatch({ title: '' })).toThrow(IpcValidationError);
    expect(() => assertPlaylistPatch(null)).toThrow(IpcValidationError);
    expect(() => assertPlaylistPatch([])).toThrow(IpcValidationError);
  });

  it('accepts a de-duplicated list of 1 to 5000 ids', () => {
    expect(assertIdList(['a-1', 'b', 'a-1'])).toEqual(['a-1', 'b']);
    expect(() => assertIdList([])).toThrow(IpcValidationError);
    expect(() => assertIdList(['../x'])).toThrow(IpcValidationError);
    expect(() => assertIdList(Array.from({ length: 5001 }, (_, i) => `id${i}`))).toThrow(IpcValidationError);
    expect(() => assertIdList('a')).toThrow(IpcValidationError);
  });

  it('accepts null or an id as the move anchor', () => {
    expect(assertOptionalId(null)).toBeNull();
    expect(assertOptionalId('abc')).toBe('abc');
    expect(() => assertOptionalId(undefined)).toThrow(IpcValidationError);
  });
});

describe('Spotify jobs and links', () => {
  const song = { id: '3XmwAZpIMNpTJy8faw3ajD', title: 'expectations', artist: 'Olivia Rodrigo', coverUrl: 'https://i.scdn.co/image/a' };
  const spotifyJob = {
    url: `https://open.spotify.com/track/${song.id}`,
    videoId: '',
    title: 'Olivia Rodrigo - expectations',
    thumbnailUrl: 'https://i.scdn.co/image/a',
    kind: 'audio',
    quality: '1080',
    subtitles: false,
    spotify: song,
    collection: { youtubeId: 'spotify-4aawyAB9vmqN3uQ7FjRGTy', kind: 'album', title: 'GUTS', index: 0 },
  };

  it('accepts an unmatched song by its Spotify link', () => {
    expect(assertJobInputs([spotifyJob])).toEqual([spotifyJob]);
  });

  it('accepts a matched song by its YouTube video', () => {
    const matched = { ...spotifyJob, videoId: 'jNQXAC9IVRw', url: 'https://youtu.be/jNQXAC9IVRw' };
    expect(assertJobInputs([matched])[0]).toMatchObject({ videoId: 'jNQXAC9IVRw', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', spotify: song });
  });

  it('rejects songs that do not add up', () => {
    expect(() => assertJobInputs([{ ...spotifyJob, kind: 'video' }])).toThrow(IpcValidationError);
    expect(() => assertJobInputs([{ ...spotifyJob, url: 'https://open.spotify.com/track/AAAAAAAAAAAAAAAAAAAAAA' }])).toThrow(IpcValidationError);
    expect(() => assertJobInputs([{ ...spotifyJob, spotify: { ...song, id: 'nope' } }])).toThrow(IpcValidationError);
    expect(() => assertJobInputs([{ ...spotifyJob, spotify: undefined }])).toThrow(IpcValidationError);
  });

  it('drops a cover from outside Spotify', () => {
    const [cleaned] = assertJobInputs([{ ...spotifyJob, spotify: { ...song, coverUrl: 'https://evil.example/a.jpg' } }]);
    expect(cleaned?.spotify).toEqual({ id: song.id, title: song.title, artist: song.artist });
  });

  it('accepts YouTube and Spotify links only', () => {
    expect(assertLink('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
    expect(assertLink('https://youtu.be/jNQXAC9IVRw')).toBe('https://youtu.be/jNQXAC9IVRw');
    expect(() => assertLink('https://open.spotify.com/artist/37i9dQZF1DXcBWIGoYBM5M')).toThrow(IpcValidationError);
    expect(() => assertLink(42)).toThrow(IpcValidationError);
  });
});
