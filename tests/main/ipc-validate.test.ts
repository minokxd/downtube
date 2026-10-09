import { describe, expect, it } from 'vitest';
import {
  IpcValidationError,
  assertBoolean,
  assertId,
  assertJobInputs,
  assertOptionalDuration,
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
