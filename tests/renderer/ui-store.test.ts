import { beforeEach, describe, expect, it } from 'vitest';
import { useUi } from '../../src/renderer/src/stores/ui';

beforeEach(() => useUi.setState({ video: null, page: 'library', libraryView: null, newPlaylist: null }));

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

describe('library view', () => {
  it('opens a playlist from any page and closes it again', () => {
    useUi.setState({ page: 'settings' });
    useUi.getState().openLibraryView({ type: 'playlist', id: 'p1' });
    expect(useUi.getState().page).toBe('library');
    expect(useUi.getState().libraryView).toEqual({ type: 'playlist', id: 'p1' });
    useUi.getState().closeLibraryView();
    expect(useUi.getState().libraryView).toBeNull();
  });

  it('drops the open view when the user switches pages', () => {
    useUi.getState().openLibraryView({ type: 'collection', id: 'c1' });
    useUi.getState().setPage('library');
    expect(useUi.getState().libraryView).toBeNull();
  });
});

describe('new playlist request', () => {
  it('carries the items the new playlist should receive', () => {
    useUi.getState().startNewPlaylist(['a', 'b']);
    expect(useUi.getState().newPlaylist).toEqual({ itemIds: ['a', 'b'] });
    useUi.getState().startNewPlaylist();
    expect(useUi.getState().newPlaylist).toEqual({ itemIds: [] });
    useUi.getState().endNewPlaylist();
    expect(useUi.getState().newPlaylist).toBeNull();
  });
});
