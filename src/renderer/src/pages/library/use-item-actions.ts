import { useMemo } from 'react';
import type { LibraryItem } from '@shared/types';
import { useT } from '../../i18n';
import { usePlayer } from '../../stores/player';
import { useSettings } from '../../stores/settings';
import { useUi } from '../../stores/ui';

export interface ItemActions {
  play(item: LibraryItem, context: readonly LibraryItem[]): void;
  enqueue(item: LibraryItem): void;
  showInFolder(item: LibraryItem): void;
  redownload(item: LibraryItem): void;
  removeEntry(item: LibraryItem): void;
}

export function useItemActions(): ItemActions {
  const t = useT();
  const openVideo = useUi((s) => s.openVideo);
  const pushToast = useUi((s) => s.pushToast);

  return useMemo<ItemActions>(
    () => ({
      play: (item, context) => {
        if (item.missing) return;
        if (item.kind === 'video') {
          openVideo(item.id);
          return;
        }
        // Music plays inside the list it was started from, so next/previous follow that list.
        const ids = context.filter((i) => i.kind === 'audio' && !i.missing).map((i) => i.id);
        usePlayer.getState().playItems(ids, Math.max(0, ids.indexOf(item.id)));
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
    [openVideo, pushToast, t],
  );
}
