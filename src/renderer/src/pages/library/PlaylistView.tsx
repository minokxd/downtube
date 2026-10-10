import { ChevronLeft, Play, Shuffle } from 'lucide-react';
import { useEffect, useMemo, useState, type DragEvent } from 'react';
import type { LibraryItem, Playlist } from '@shared/types';
import { LibraryThumb } from '../../components/LibraryThumb';
import { PlaylistIcon } from '../../components/PlaylistIcon';
import { useT } from '../../i18n';
import { anchorFor, dropSide, hasDragItems, readDragItems, type DropSide } from '../../lib/drag';
import { formatDuration } from '../../lib/format';
import { coverItem, totalDuration } from '../../lib/playlists';
import { usePlaylistActions } from '../../lib/use-playlist-actions';
import { collectionItems } from './library-logic';
import { MediaCard } from './MediaCard';
import type { ItemActions } from './use-item-actions';
import type { Modifiers } from './use-selection';

export function PlaylistView({
  playlist,
  items,
  onBack,
  onMenu,
  actions,
  selectedIds,
  onSelectClick,
  onDragStart,
}: {
  playlist: Playlist;
  items: readonly LibraryItem[];
  onBack: () => void;
  onMenu: (item: LibraryItem, x: number, y: number) => void;
  actions: ItemActions;
  selectedIds: ReadonlySet<string>;
  onSelectClick: (item: LibraryItem, modifiers: Modifiers) => boolean;
  onDragStart: (item: LibraryItem, event: DragEvent<HTMLElement>) => void;
}) {
  const t = useT();
  const list = useMemo(() => collectionItems(playlist, items), [playlist, items]);
  const playlistActions = usePlaylistActions();
  const order = useMemo(() => list.map((item) => item.id), [list]);
  const [indicator, setIndicator] = useState<{ id: string; side: DropSide } | null>(null);

  useEffect(() => {
    const clear = () => setIndicator(null);
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    return () => {
      window.removeEventListener('dragend', clear);
      window.removeEventListener('drop', clear);
    };
  }, []);
  const cover = coverItem(list);
  const playable = list.some((item) => !item.missing);

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm collection-back" onClick={onBack}>
        <ChevronLeft size={16} aria-hidden="true" />
        {t('library.back')}
      </button>
      <header className="collection-header">
        {playlist.emoji ? (
          <div className="collection-cover is-emoji" aria-hidden="true">
            {playlist.emoji}
          </div>
        ) : cover ? (
          <LibraryThumb item={cover} className="collection-cover" />
        ) : (
          <div className="collection-cover is-emoji" aria-hidden="true">
            <PlaylistIcon size={44} />
          </div>
        )}
        <div className="collection-info">
          <span className="badge">{t('playlist.badge')}</span>
          <h1 className="page-title">{playlist.title}</h1>
          <p className="muted">{t('playlist.summary', { count: list.length, duration: formatDuration(totalDuration(list)) })}</p>
          {playable && (
            <div className="music-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => actions.playAll(list, false)}>
                <Play size={14} aria-hidden="true" />
                {t('library.playAll')}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => actions.playAll(list, true)}>
                <Shuffle size={14} aria-hidden="true" />
                {t('library.shuffleAll')}
              </button>
            </div>
          )}
        </div>
      </header>
      {list.length === 0 ? (
        <p className="library-noresults">{t('playlist.empty')}</p>
      ) : (
        <div className="grid">
          {list.map((item) => (
            <div
              key={item.id}
              className={`reorder-slot${indicator?.id === item.id ? ` is-drop-${indicator.side}` : ''}`}
              onDragOver={(event) => {
                if (!hasDragItems(event.dataTransfer)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                const side = dropSide(event.clientX, event.currentTarget.getBoundingClientRect());
                setIndicator((current) => (current?.id === item.id && current.side === side ? current : { id: item.id, side }));
              }}
              onDrop={(event) => {
                event.preventDefault();
                const side = dropSide(event.clientX, event.currentTarget.getBoundingClientRect());
                setIndicator(null);
                const ids = readDragItems(event.dataTransfer).filter((id) => order.includes(id));
                if (ids.length > 0) playlistActions.moveItems(playlist.id, ids, anchorFor(order, item.id, side));
              }}
            >
              <MediaCard
                item={item}
                selected={selectedIds.has(item.id)}
                onSelectClick={onSelectClick}
                onDragStart={onDragStart}
                onPlay={(target) => actions.play(target, list, { sequence: true })}
                onMenu={onMenu}
                onRedownload={actions.redownload}
                onRemoveMissing={actions.removeEntry}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
