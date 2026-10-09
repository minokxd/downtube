import { describe, expect, it } from 'vitest';
import { classifyUrl, isYoutubeUrl } from '@shared/youtube-url';

const ID = 'jNQXAC9IVRw';
const WATCH = `https://www.youtube.com/watch?v=${ID}`;

describe('classifyUrl', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `youtube.com/watch?v=${ID}&t=10s`,
    `https://youtu.be/${ID}?si=abc`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}&feature=share`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `  https://www.youtube.com/embed/${ID}  `,
  ])('recognises the video link %s', (input) => {
    expect(classifyUrl(input)).toEqual({ kind: 'video', videoId: ID, url: WATCH });
  });

  it('keeps the playlist id of a watch link', () => {
    expect(classifyUrl(`${WATCH}&list=PLabc123_-`)).toEqual({ kind: 'video', videoId: ID, url: WATCH, listId: 'PLabc123_-' });
  });

  it('recognises playlists', () => {
    expect(classifyUrl('https://www.youtube.com/playlist?list=PLabc123')).toEqual({
      kind: 'playlist',
      listId: 'PLabc123',
      url: 'https://www.youtube.com/playlist?list=PLabc123',
    });
  });

  it.each([
    ['https://www.youtube.com/@jawed', 'https://www.youtube.com/@jawed/videos'],
    ['https://www.youtube.com/@jawed/shorts', 'https://www.youtube.com/@jawed/videos'],
    ['https://www.youtube.com/channel/UC4QobU6STFB0P71PMvOGN5A', 'https://www.youtube.com/channel/UC4QobU6STFB0P71PMvOGN5A/videos'],
    ['https://www.youtube.com/c/SomeName', 'https://www.youtube.com/c/SomeName/videos'],
    ['https://www.youtube.com/user/SomeName/featured', 'https://www.youtube.com/user/SomeName/videos'],
  ])('normalises the channel link %s to its videos tab', (input, url) => {
    expect(classifyUrl(input)).toEqual({ kind: 'channel', url });
  });

  it.each([
    '',
    'hello',
    'two words',
    'https://vimeo.com/123456',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/',
    'https://www.youtube.com/playlist',
    'javascript:alert(1)',
    `ftp://youtube.com/watch?v=${ID}`,
    `https://youtube.com.evil.example/watch?v=${ID}`,
  ])('rejects %j', (input) => {
    expect(classifyUrl(input)).toEqual({ kind: 'invalid' });
    expect(isYoutubeUrl(input)).toBe(false);
  });
});
