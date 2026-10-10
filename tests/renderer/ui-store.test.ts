import { beforeEach, describe, expect, it } from 'vitest';
import { useUi } from '../../src/renderer/src/stores/ui';

beforeEach(() => useUi.setState({ video: null }));

describe('video queue', () => {
  it('opens a single video as a queue of one', () => {
    useUi.getState().openVideo('a');
    expect(useUi.getState().video).toEqual({ ids: ['a'], index: 0 });
  });

  it('plays a list from a clamped start index and ignores an empty list', () => {
    useUi.getState().playVideos(['a', 'b', 'c'], 7);
    expect(useUi.getState().video).toEqual({ ids: ['a', 'b', 'c'], index: 2 });
    useUi.getState().playVideos([]);
    expect(useUi.getState().video?.ids).toEqual(['a', 'b', 'c']);
  });

  it('moves within the queue, ignores out-of-range indexes and closes', () => {
    useUi.getState().playVideos(['a', 'b']);
    useUi.getState().setVideoIndex(1);
    expect(useUi.getState().video?.index).toBe(1);
    useUi.getState().setVideoIndex(5);
    expect(useUi.getState().video?.index).toBe(1);
    useUi.getState().closeVideo();
    expect(useUi.getState().video).toBeNull();
  });
});
