import { describe, expect, it } from 'vitest';
import { normalizeList, normalizeVideo } from '../../src/main/ytdlp/probe-normalize';

const videoJson = {
  _type: 'video',
  id: 'jNQXAC9IVRw',
  title: 'Me at the zoo',
  channel: 'jawed',
  uploader: 'jawed',
  duration: 19,
  thumbnail: 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg',
  subtitles: { en: [], de: [] },
  formats: [
    { format_id: 'sb0', vcodec: 'none', acodec: 'none', height: 90 },
    { format_id: '140', vcodec: 'none', acodec: 'mp4a.40.2' },
    { format_id: '160', vcodec: 'avc1.4d400c', height: 144 },
    { format_id: '133', vcodec: 'avc1.4d4015', height: 240 },
    { format_id: '278', vcodec: 'vp9', height: 144 },
  ],
};

describe('normalizeVideo', () => {
  it('extracts the fields the dialog needs', () => {
    expect(normalizeVideo(videoJson, 'PLx')).toEqual({
      videoId: 'jNQXAC9IVRw',
      url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      title: 'Me at the zoo',
      durationSec: 19,
      thumbnailUrl: 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg',
      channel: 'jawed',
      heights: [144, 240],
      hasSubtitles: true,
      listId: 'PLx',
    });
  });

  it('ignores live chat as a subtitle and falls back to the uploader', () => {
    const result = normalizeVideo({ ...videoJson, channel: null, subtitles: { live_chat: [] } });
    expect(result.hasSubtitles).toBe(false);
    expect(result.channel).toBe('jawed');
    expect(result).not.toHaveProperty('listId');
  });

  it('throws when the id is missing', () => {
    expect(() => normalizeVideo({ title: 'x' })).toThrow();
  });
});

const channelJson = {
  _type: 'playlist',
  id: 'UC4QobU6STFB0P71PMvOGN5A',
  title: 'jawed - Videos',
  channel: 'jawed',
  playlist_count: 1,
  entries: [
    {
      _type: 'url',
      id: 'jNQXAC9IVRw',
      url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      title: 'Me at the zoo',
      duration: 19,
      thumbnails: [
        { url: 'https://i.ytimg.com/small.jpg', width: 168, height: 94 },
        { url: 'https://i.ytimg.com/big.jpg', width: 480, height: 270 },
      ],
    },
    { _type: 'url', id: 'aaaaaaaaaaa', title: '[Private video]', duration: null },
    { _type: 'url', id: 'not-an-id' },
  ],
};

describe('normalizeList', () => {
  it('maps a channel page', () => {
    const result = normalizeList(channelJson, 'channel', 'https://www.youtube.com/@jawed/videos', 1, 100);
    expect(result).toEqual({
      listKind: 'channel',
      youtubeId: 'UC4QobU6STFB0P71PMvOGN5A',
      title: 'jawed',
      channel: 'jawed',
      totalCount: 1,
      entries: [
        {
          videoId: 'jNQXAC9IVRw',
          url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
          title: 'Me at the zoo',
          durationSec: 19,
          thumbnailUrl: 'https://i.ytimg.com/big.jpg',
          channel: undefined,
        },
      ],
      hasMore: false,
      nextStart: 101,
      sourceUrl: 'https://www.youtube.com/@jawed/videos',
    });
  });

  it('reports more pages when the raw page is full', () => {
    const entries = Array.from({ length: 3 }, (_, i) => ({ id: `abcdefghij${i}`, title: `Video ${i}` }));
    const result = normalizeList({ id: 'PL1', title: 'Mix', entries }, 'playlist', 'https://www.youtube.com/playlist?list=PL1', 4, 3);
    expect(result.hasMore).toBe(true);
    expect(result.nextStart).toBe(7);
    expect(result.title).toBe('Mix');
    expect(result.totalCount).toBeUndefined();
  });
});
