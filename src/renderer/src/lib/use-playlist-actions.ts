import { useMemo } from 'react';
import type { Playlist } from '@shared/types';
import { useT } from '../i18n';
import { useUi } from '../stores/ui';
import { addResultMessage } from './playlists';

export interface PlaylistActions {
  create(title: string, emoji?: string): Promise<Playlist | null>;
  rename(id: string, title: string): void;
  setEmoji(id: string, emoji: string | null): void;
  remove(id: string): void;
  addItems(playlist: Playlist, itemIds: string[]): void;
  removeItems(id: string, itemIds: string[]): void;
  moveItems(id: string, itemIds: string[], beforeId: string | null): void;
}

/**
 * Playlist changes go to main and come back through library:changed; nothing is updated optimistically,
 * so a failed write leaves the screen showing what is really saved.
 */
export function usePlaylistActions(): PlaylistActions {
  const t = useT();
  const pushToast = useUi((s) => s.pushToast);
  return useMemo<PlaylistActions>(() => {
    const failed = (): void => {
      pushToast({ message: t('playlist.saveFailed'), tone: 'error' });
    };
    const api = window.downtube.playlists;
    return {
      create: (title, emoji) =>
        api.create(title, emoji).catch(() => {
          failed();
          return null;
        }),
      rename: (id, title) => {
        api.update(id, { title }).catch(failed);
      },
      setEmoji: (id, emoji) => {
        api.update(id, { emoji }).catch(failed);
      },
      remove: (id) => {
        api.remove(id).catch(failed);
      },
      addItems: (playlist, itemIds) => {
        if (itemIds.length === 0) return;
        api
          .addItems(playlist.id, itemIds)
          .then((result) => {
            const { key, vars } = addResultMessage(result, playlist.title);
            pushToast({ message: t(key, vars), tone: result.added > 0 ? 'success' : 'info' });
          })
          .catch(failed);
      },
      removeItems: (id, itemIds) => {
        if (itemIds.length > 0) api.removeItems(id, itemIds).catch(failed);
      },
      moveItems: (id, itemIds, beforeId) => {
        if (itemIds.length > 0) api.moveItems(id, itemIds, beforeId).catch(failed);
      },
    };
  }, [pushToast, t]);
}
