import { describe, expect, it } from 'vitest';
import type { LibraryItem, ProbeEntry, ProbeList, ProbeVideo } from '@shared/types';
import { estimateBytes } from '@shared/size-estimate';
import {
  inLibraryIds,
  listJobs,
  listSize,
  listSubmitIds,
  mergeEntries,
  playlistUrl,
  videoJob,
  videoSize,
} from '../../src/renderer/src/components/add-dialog-logic';

const video: ProbeVideo = {
  videoId: 'jNQXAC9IVRw',
  url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  title: 'Me at the zoo',
  channel: 'jawed',
  heights: [240],
  hasSubtitles: true,
  thumbnailUrl: 'https://i.ytimg.com/x.jpg',
};

const entry = (id: string): ProbeEntry => ({ videoId: id, url: `https://www.youtube.com/watch?v=${id}`, title: `T ${id}` });

const list: ProbeList = {
  listKind: 'playlist',
  youtubeId: 'PL1',
  title: 'My list',
  entries: [],
  hasMore: false,
  nextStart: 101,
  sourceUrl: 'https://www.youtube.com/playlist?list=PL1',
};

describe('videoJob', () => {
  it('builds a single video job', () => {
    expect(videoJob(video, { kind: 'video', quality: '720', subtitles: true })).toEqual({
      url: video.url,
      videoId: video.videoId,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      kind: 'video',
      quality: '720',
      subtitles: true,
    });
  });

  it('never asks for subtitles on music', () => {
    expect(videoJob(video, { kind: 'audio', quality: 'best', subtitles: true }).subtitles).toBe(false);
  });
});

describe('listJobs', () => {
  it('keeps the playlist position of each selected entry', () => {
    const entries = [entry('aaaaaaaaaaa'), entry('bbbbbbbbbbb'), entry('ccccccccccc')];
    const jobs = listJobs(list, entries, new Set(['aaaaaaaaaaa', 'ccccccccccc']), { kind: 'audio', quality: 'best', subtitles: false });
    expect(jobs.map((j) => [j.videoId, j.collection?.index])).toEqual([
      ['aaaaaaaaaaa', 0],
      ['ccccccccccc', 2],
    ]);
    expect(jobs[0]?.collection).toEqual({ youtubeId: 'PL1', kind: 'playlist', title: 'My list', index: 0 });
  });
});

describe('listSubmitIds', () => {
  const entries = [entry('aaaaaaaaaaa'), entry('bbbbbbbbbbb'), entry('ccccccccccc')];
  const owned = new Set(['bbbbbbbbbbb']);
  const choice = { kind: 'video' as const, quality: '1080' as const, subtitles: false };

  it('adds the owned entries of the loaded list to the chosen ones', () => {
    const ids = listSubmitIds(entries, [entries[0]!], owned);
    expect([...ids].sort()).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
  });

  it('keeps the list positions, so owned entries get the right place in the new collection', () => {
    const jobs = listJobs(list, entries, listSubmitIds(entries, [entries[2]!], owned), choice);
    expect(jobs.map((j) => [j.videoId, j.collection?.index])).toEqual([
      ['bbbbbbbbbbb', 1],
      ['ccccccccccc', 2],
    ]);
  });

  it('ignores owned ids that are not in the loaded list', () => {
    expect([...listSubmitIds(entries, [entries[0]!], new Set(['zzzzzzzzzzz']))]).toEqual(['aaaaaaaaaaa']);
  });
});

describe('mergeEntries', () => {
  it('appends new entries without duplicates', () => {
    const merged = mergeEntries([entry('aaaaaaaaaaa')], [entry('aaaaaaaaaaa'), entry('bbbbbbbbbbb')]);
    expect(merged.map((e) => e.videoId)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
  });
});

describe('inLibraryIds', () => {
  it('counts only playable items of the same kind', () => {
    const items = [
      { videoId: 'aaaaaaaaaaa', kind: 'video' },
      { videoId: 'bbbbbbbbbbb', kind: 'video', missing: true },
      { videoId: 'ccccccccccc', kind: 'audio' },
    ] as LibraryItem[];
    expect([...inLibraryIds(items, 'video')]).toEqual(['aaaaaaaaaaa']);
  });
});

describe('playlistUrl', () => {
  it('builds a playlist link', () => {
    expect(playlistUrl('PL_1')).toBe('https://www.youtube.com/playlist?list=PL_1');
  });
});

describe('videoSize', () => {
  const sized: ProbeVideo = { ...video, durationSec: 100, sizes: { best: 900, '1080': 500 } };

  it("uses YouTube's size for the chosen quality", () => {
    expect(videoSize(sized, 'video', '1080')).toEqual({ bytes: 500, estimated: false, atLeast: false });
  });

  it('estimates from the duration when YouTube gave no size for that quality', () => {
    expect(videoSize(sized, 'video', '720')).toEqual({ bytes: estimateBytes(100, 'video', '720'), estimated: true, atLeast: false });
  });

  it('always estimates an mp3, since conversion decides its size', () => {
    expect(videoSize(sized, 'audio', '1080')).toEqual({ bytes: estimateBytes(100, 'audio', '1080'), estimated: true, atLeast: false });
  });

  it('has nothing to show without sizes or a duration', () => {
    expect(videoSize(video, 'video', '1080')).toBeUndefined();
  });
});

describe('listSize', () => {
  const timed = (id: string, durationSec?: number): ProbeEntry => ({ ...entry(id), durationSec });

  it('adds up the estimates of the chosen entries', () => {
    expect(listSize([timed('a', 60), timed('b', 120)], 'audio', '1080')).toEqual({
      bytes: estimateBytes(180, 'audio', '1080'),
      estimated: true,
      atLeast: false,
    });
  });

  it('says "at least" when some durations are unknown', () => {
    expect(listSize([timed('a', 60), timed('b')], 'video', '720')).toEqual({
      bytes: estimateBytes(60, 'video', '720'),
      estimated: true,
      atLeast: true,
    });
  });

  it('says "at least" for best video, which is counted as 1080p', () => {
    expect(listSize([timed('a', 60)], 'video', 'best')?.atLeast).toBe(true);
    expect(listSize([timed('a', 60)], 'audio', 'best')?.atLeast).toBe(false);
  });

  it('has nothing to show when no duration is known', () => {
    expect(listSize([timed('a')], 'video', '1080')).toBeUndefined();
    expect(listSize([], 'video', '1080')).toBeUndefined();
  });
});
