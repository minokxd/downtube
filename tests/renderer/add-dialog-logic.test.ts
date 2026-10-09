import { describe, expect, it } from 'vitest';
import type { LibraryItem, ProbeEntry, ProbeList, ProbeVideo } from '@shared/types';
import { inLibraryIds, listJobs, mergeEntries, playlistUrl, videoJob } from '../../src/renderer/src/components/add-dialog-logic';

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
