import { describe, expect, it } from 'vitest';
import { parseLine } from '../../src/main/ytdlp/output';
import { ProgressTracker, initialProgress } from '../../src/main/ytdlp/progress';

const feed = (tracker: ProgressTracker, line: string) => tracker.apply(parseLine(line));

describe('ProgressTracker', () => {
  it('starts at zero', () => {
    expect(initialProgress()).toEqual({ percent: 0, downloadedBytes: 0, stage: 'download' });
  });

  it('maps a merged video download onto one monotonic bar', () => {
    const tracker = new ProgressTracker('video');
    expect(feed(tracker, 'DT_PROGRESS downloading|440|NA|NA|49094|NA|NA')).toBeNull();
    expect(feed(tracker, 'DT_PROGRESS finished|440|440|NA|2806|NA|NA')).toBeNull();
    expect(feed(tracker, 'DT_PROGRESS downloading|216540|433081|NA|1000|2|133')).toEqual({
      percent: 45,
      downloadedBytes: 216540,
      totalBytes: 433081,
      speedBps: 1000,
      etaSec: 2,
      stage: 'download',
    });
    expect(feed(tracker, 'DT_PROGRESS finished|433081|433081|NA|1000|NA|133')?.percent).toBe(90);
    expect(feed(tracker, 'DT_PROGRESS downloading|154644|309288|NA|1000|1|140')?.percent).toBe(94.5);
    expect(feed(tracker, 'DT_PROGRESS downloading|1|309288|NA|1000|1|140')?.percent).toBe(94.5);
  });

  it('switches stages on known postprocessors and clears speed', () => {
    const tracker = new ProgressTracker('video');
    feed(tracker, 'DT_PROGRESS downloading|50|100|NA|1000|1|137');
    expect(feed(tracker, 'DT_PP Merger|started')).toMatchObject({ stage: 'merge', percent: 45, speedBps: undefined, etaSec: undefined });
    expect(feed(tracker, 'DT_PP Merger|finished')).toBeNull();
    expect(feed(tracker, 'DT_PP MoveFiles|started')).toBeNull();
  });

  it('uses the audio range for music', () => {
    const tracker = new ProgressTracker('audio');
    expect(feed(tracker, 'DT_PROGRESS downloading|50|100|NA|10|5|251')?.percent).toBe(47.5);
    expect(feed(tracker, 'DT_PP ExtractAudio|started')?.stage).toBe('convert');
    expect(feed(tracker, 'DT_PP EmbedThumbnail|started')?.stage).toBe('thumbnail');
  });

  it('ignores log and done events', () => {
    const tracker = new ProgressTracker('video');
    expect(tracker.apply({ type: 'log', line: 'hello' })).toBeNull();
    expect(tracker.progress).toEqual(initialProgress());
  });
});
