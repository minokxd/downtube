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

// `formats` arrive sorted worst → best by the download's -S, so the last fitting one is yt-dlp's pick.
const withFormats = (formats: object[], duration = 100) => normalizeVideo({ id: 'jNQXAC9IVRw', title: 't', duration, formats });

describe('normalizeVideo sizes', () => {
  it('adds the best audio to the best video at or below each quality', () => {
    const video = withFormats([
      { format_id: 'sb0', vcodec: 'none', acodec: 'none', filesize: 9 },
      { format_id: '249', vcodec: 'none', acodec: 'opus', filesize: 1_000 },
      { format_id: '140', vcodec: 'none', acodec: 'mp4a.40.2', filesize: 2_000 },
      { format_id: '160', vcodec: 'avc1', acodec: 'none', height: 144, filesize: 100 },
      { format_id: '135', vcodec: 'avc1', acodec: 'none', height: 480, filesize: 10_000 },
      { format_id: '398', vcodec: 'av01', acodec: 'none', height: 720, filesize: 15_000 },
      { format_id: '136', vcodec: 'avc1', acodec: 'none', height: 720, filesize: 20_000 },
      { format_id: '137', vcodec: 'avc1', acodec: 'none', height: 1080, filesize: 40_000 },
      { format_id: '313', vcodec: 'vp9', acodec: 'none', height: 2160, filesize: 300_000 },
    ]);
    expect(video.sizes).toEqual({ best: 302_000, '1080': 42_000, '720': 22_000, '480': 12_000 });
  });

  it('falls back to the approximate size, then to bitrate times duration', () => {
    const video = withFormats(
      [
        { format_id: '140', vcodec: 'none', acodec: 'mp4a.40.2', filesize_approx: 1_500 },
        { format_id: '137', vcodec: 'avc1', acodec: 'none', height: 1080, tbr: 800 },
      ],
      100,
    );
    // 800 kbit/s for 100 s = 10 MB
    expect(video.sizes?.['1080']).toBe(10_001_500);
  });

  it('measures resolution on the smaller side like yt-dlp, so a vertical 1080×1920 is 1080p', () => {
    const video = withFormats([
      { format_id: '140', vcodec: 'none', acodec: 'mp4a.40.2', filesize: 1_000 },
      { format_id: 'v720', vcodec: 'avc1', acodec: 'none', width: 720, height: 1280, filesize: 20_000 },
      { format_id: 'v1080', vcodec: 'avc1', acodec: 'none', width: 1080, height: 1920, filesize: 50_000 },
    ]);
    expect(video.sizes?.['1080']).toBe(51_000);
    expect(video.sizes?.['720']).toBe(21_000);
  });

  it('does not add audio to a format that already carries it', () => {
    const video = withFormats([
      { format_id: '140', vcodec: 'none', acodec: 'mp4a.40.2', filesize: 1_000 },
      { format_id: '18', vcodec: 'avc1', acodec: 'mp4a.40.2', height: 360, filesize: 5_000 },
    ]);
    expect(video.sizes?.['480']).toBe(5_000);
  });

  it('leaves out a quality whose size is unknown and omits sizes when none is known', () => {
    const partial = withFormats([
      { format_id: '140', vcodec: 'none', acodec: 'mp4a.40.2', filesize: 1_000 },
      { format_id: '136', vcodec: 'avc1', acodec: 'none', height: 720, filesize: 20_000 },
      { format_id: '137', vcodec: 'avc1', acodec: 'none', height: 1080 },
    ]);
    // best and 1080 both land on 137, whose size is unknown; nothing fits under 480.
    expect(partial.sizes).toEqual({ '720': 21_000 });
    const unknown = withFormats([{ format_id: '137', vcodec: 'avc1', acodec: 'none', height: 1080 }]);
    expect(unknown).not.toHaveProperty('sizes');
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
