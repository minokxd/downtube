import { ArrowLeft, ArrowRight, ChevronRight, FolderOpen, ListMinus, ListMusic, ListPlus, Play, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { LibraryItem } from '@shared/types';
import { ContextMenu } from '../../components/ContextMenu';
import { PlaylistPicker } from '../../components/PlaylistPicker';
import { useT } from '../../i18n';
import { usePlaylistActions } from '../../lib/use-playlist-actions';
import { useUi } from '../../stores/ui';

/** Extra entries when the menu opens on the user's playlist page. A missing move handler disables that entry. */
export interface ItemMenuPlaylist {
  onRemove: () => void;
  onMoveEarlier?: () => void;
  onMoveLater?: () => void;
}

export function ItemMenu({
  item,
  x,
  y,
  targetIds,
  playlist,
  onClose,
  onPlay,
  onEnqueue,
  onShowInFolder,
  onDelete,
}: {
  item: LibraryItem;
  x: number;
  y: number;
  /** What "Add to playlist" adds: the selection when the item is part of it, otherwise the item. */
  targetIds: string[];
  playlist?: ItemMenuPlaylist;
  onClose: () => void;
  onPlay: (item: LibraryItem) => void;
  onEnqueue: (item: LibraryItem) => void;
  onShowInFolder: (item: LibraryItem) => void;
  onDelete: (item: LibraryItem) => void;
}) {
  const t = useT();
  const playlistActions = usePlaylistActions();
  const startNewPlaylist = useUi((s) => s.startNewPlaylist);
  // "Add to playlist" swaps the menu to the playlist list instead of opening a flyout that could leave the screen.
  const [mode, setMode] = useState<'main' | 'playlists'>('main');
  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <ContextMenu x={x} y={y} onClose={onClose} contentKey={mode}>
      {mode === 'playlists' ? (
        <PlaylistPicker
          onBack={() => setMode('main')}
          onPick={(target) => {
            playlistActions.addItems(target, targetIds);
            onClose();
          }}
          onNew={() => {
            startNewPlaylist(targetIds);
            onClose();
          }}
        />
      ) : (
        <>
          <button type="button" role="menuitem" disabled={item.missing} onClick={act(() => onPlay(item))}>
            <Play size={14} aria-hidden="true" />
            {t('menu.play')}
          </button>
          {item.kind === 'audio' && (
            <button type="button" role="menuitem" disabled={item.missing} onClick={act(() => onEnqueue(item))}>
              <ListPlus size={14} aria-hidden="true" />
              {t('menu.addToQueue')}
            </button>
          )}
          <button type="button" role="menuitem" aria-haspopup="menu" onClick={() => setMode('playlists')}>
            <ListMusic size={14} aria-hidden="true" />
            <span className="menu-label">{t('playlist.addTo')}</span>
            <ChevronRight size={14} className="menu-chevron" aria-hidden="true" />
          </button>
          {playlist && (
            <>
              <button type="button" role="menuitem" onClick={act(playlist.onRemove)}>
                <ListMinus size={14} aria-hidden="true" />
                {t('playlist.removeFrom')}
              </button>
              <button type="button" role="menuitem" disabled={!playlist.onMoveEarlier} onClick={act(() => playlist.onMoveEarlier?.())}>
                <ArrowLeft size={14} aria-hidden="true" />
                {t('playlist.moveEarlier')}
              </button>
              <button type="button" role="menuitem" disabled={!playlist.onMoveLater} onClick={act(() => playlist.onMoveLater?.())}>
                <ArrowRight size={14} aria-hidden="true" />
                {t('playlist.moveLater')}
              </button>
            </>
          )}
          <button type="button" role="menuitem" disabled={item.missing} onClick={act(() => onShowInFolder(item))}>
            <FolderOpen size={14} aria-hidden="true" />
            {t('menu.showInFolder')}
          </button>
          <div className="menu-sep" />
          <button type="button" role="menuitem" className="is-danger" onClick={act(() => onDelete(item))}>
            <Trash2 size={14} aria-hidden="true" />
            {t('menu.delete')}
          </button>
        </>
      )}
    </ContextMenu>
  );
}
