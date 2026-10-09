import { FolderOpen, ListPlus, Play, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LibraryItem } from '@shared/types';
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
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      left: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
    });
  }, [x, y]);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onClose);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    return () => {
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onClose);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  const act = (fn: (item: LibraryItem) => void) => () => {
    fn(item);
    onClose();
  };

  return createPortal(
    <div ref={ref} className="menu" role="menu" style={position}>
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
    </div>,
    document.body,
  );
}
