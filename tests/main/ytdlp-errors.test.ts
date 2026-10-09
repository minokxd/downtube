import { describe, expect, it } from 'vitest';
import { YtdlpError, errorCodeOf, mapError } from '../../src/main/ytdlp/errors';

describe('mapError', () => {
  it.each([
    ["ERROR: [youtube] abc: Private video. Sign in if you've been granted access to this video", 'PRIVATE'],
    ['ERROR: [youtube] abc: Sign in to confirm your age. This video may be inappropriate for some users.', 'AGE_RESTRICTED'],
    ['ERROR: [youtube] abc: Sign in to confirm you’re not a bot. Use --cookies-from-browser', 'BOT_CHECK'],
    ["ERROR: [youtube] abc: Sign in to confirm you're not a bot.", 'BOT_CHECK'],
    ['ERROR: [youtube] abc: The uploader has not made this video available in your country', 'GEO_BLOCKED'],
    ['ERROR: [youtube] abc: Video unavailable', 'UNAVAILABLE'],
    ['ERROR: [youtube] abc: This video has been removed by the uploader', 'UNAVAILABLE'],
    ['ERROR: Unable to download webpage: <urlopen error [Errno 11001] getaddrinfo failed>', 'NETWORK'],
    ['ERROR: unable to write data: [Errno 28] No space left on device', 'DISK_FULL'],
    ['ERROR: Postprocessing: [WinError 112] Diskte yeterli alan yok', 'DISK_FULL'],
    ['ERROR: something nobody has seen before', 'UNKNOWN'],
  ])('maps %j to %s', (log, code) => {
    expect(mapError(log)).toBe(code);
  });

  it('looks at ERROR lines before warnings', () => {
    const log = 'WARNING: [youtube] abc: this video is private in some regions\nERROR: [youtube] abc: Video unavailable';
    expect(mapError(log)).toBe('UNAVAILABLE');
  });

  it('falls back to the whole log when there are no ERROR lines', () => {
    expect(mapError('Traceback...\nOSError: [Errno 28] No space left on device')).toBe('DISK_FULL');
  });
});

describe('errorCodeOf', () => {
  it('reads codes from YtdlpError and defaults to UNKNOWN', () => {
    expect(errorCodeOf(new YtdlpError('NETWORK', 'log'))).toBe('NETWORK');
    expect(errorCodeOf(new Error('x'))).toBe('UNKNOWN');
  });
});
