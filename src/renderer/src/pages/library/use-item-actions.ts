import { useMemo } from 'react';
import type { LibraryItem } from '@shared/types';
import { useT } from '../../i18n';
import { shuffleOrder } from '../../player/queue-logic';
import { usePlayer } from '../../stores/player';
import { useSettings } from '../../stores/settings';
import { useUi } from '../../stores/ui';
import { playableIds } from './library-logic';

export interface PlayOptions {
  /** Plays the context's videos one after another, starting at this item. */
  sequence?: boolean;
}

export interface ItemActions {
  play(item: LibraryItem, context: readonly LibraryItem[], options?: PlayOptions): void;
  /** Plays the list's videos in order (or shuffled); a list with only music goes to the music bar. */
  playAll(list: readonly LibraryItem[], shuffle: boolean): void;
  enqueue(item: LibraryItem): void;
  showInFolder(item: LibraryItem): void;
  redownload(item: LibraryItem): void;
  removeEntry(item: LibraryItem): void;
}

export function useItemActions(): ItemActions {
  const t = useT();
  const openVideo = useUi((s) => s.openVideo);
  const playVideos = useUi((s) => s.playVideos);
  const pushToast = useUi((s) => s.pushToast);

  return useMemo<ItemActions>(
    () => ({
      play: (item, context, options) => {
        if (item.missing) return;
        if (item.kind === 'video') {
          if (!options?.sequence) {
            openVideo(item.id);
            return;
          }
          const ids = playableIds(context, 'video');
          playVideos(ids, Math.max(0, ids.indexOf(item.id)));
          return;
        }
        // Music plays inside the list it was started from, so next/previous follow that list.
        const ids = playableIds(context, 'audio');
        usePlayer.getState().playItems(ids, Math.max(0, ids.indexOf(item.id)));
      },
      playAll: (list, shuffle) => {
        const videos = playableIds(list, 'video');
        if (videos.length > 0) {
          playVideos(shuffle ? shuffleOrder(videos) : videos);
          return;
        }
        const audio = playableIds(list, 'audio');
        if (audio.length > 0) usePlayer.getState().playItems(audio, 0, shuffle ? { shuffle: true } : undefined);
      },
      enqueue: (item) => usePlayer.getState().enqueue([item.id]),
      showInFolder: (item) => {
        void window.downtube.library.showInFolder(item.id);
      },
      redownload: (item) => {
        const settings = useSettings.getState().settings;
        window.downtube.jobs
          .add([
            {
              url: item.sourceUrl,
              videoId: item.videoId,
              title: item.title,
              kind: item.kind,
              quality: settings?.defaultQuality ?? '1080',
              subtitles: item.kind === 'video' && (settings?.subtitles.enabled ?? false),
            },
          ])
          .then((result) => {
            if (result.added > 0) pushToast({ message: t('add.queued', { count: result.added }), tone: 'success' });
          })
          .catch(() => pushToast({ message: t('error.UNKNOWN'), tone: 'error' }));
      },
      removeEntry: (item) => {
        const { order, removeAt } = usePlayer.getState();
        const index = order.indexOf(item.id);
        if (index >= 0) removeAt(index);
        window.downtube.library
          .remove(item.id, false)
          .catch(() => pushToast({ message: t('error.UNKNOWN'), tone: 'error' }));
      },
    }),
    [openVideo, playVideos, pushToast, t],
  );
}
