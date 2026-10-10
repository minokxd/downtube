import { FolderOpen, ListPlus, Play, Trash2 } from 'lucide-react';
import type { LibraryItem } from '@shared/types';
import { ContextMenu } from '../../components/ContextMenu';
import { useT } from '../../i18n';

export function ItemMenu({
  item,
  x,
  y,
  onClose,
  onPlay,
  onEnqueue,
  onShowInFolder,
  onDelete,
}: {
  item: LibraryItem;
  x: number;
  y: number;
  onClose: () => void;
  onPlay: (item: LibraryItem) => void;
  onEnqueue: (item: LibraryItem) => void;
  onShowInFolder: (item: LibraryItem) => void;
  onDelete: (item: LibraryItem) => void;
}) {
  const t = useT();
  const act = (fn: (item: LibraryItem) => void) => () => {
    fn(item);
    onClose();
  };

  return (
    <ContextMenu x={x} y={y} onClose={onClose}>
      <button type="button" role="menuitem" disabled={item.missing} onClick={act(onPlay)}>
        <Play size={14} aria-hidden="true" />
        {t('menu.play')}
      </button>
      {item.kind === 'audio' && (
        <button type="button" role="menuitem" disabled={item.missing} onClick={act(onEnqueue)}>
          <ListPlus size={14} aria-hidden="true" />
          {t('menu.addToQueue')}
        </button>
      )}
      <button type="button" role="menuitem" disabled={item.missing} onClick={act(onShowInFolder)}>
        <FolderOpen size={14} aria-hidden="true" />
        {t('menu.showInFolder')}
      </button>
      <div className="menu-sep" />
      <button type="button" role="menuitem" className="is-danger" onClick={act(onDelete)}>
        <Trash2 size={14} aria-hidden="true" />
        {t('menu.delete')}
      </button>
    </ContextMenu>
  );
}
