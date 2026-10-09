import { useEffect, useState } from 'react';
import type { LibraryItem } from '@shared/types';
import { useT } from '../../i18n';
import { useLibrary } from '../../stores/library';
import { usePlayer } from '../../stores/player';
import { useUi } from '../../stores/ui';

// Main rejects with this text when the entry was removed but some sidecar files stayed on disk.
const PARTIAL_REMOVAL = 'Could not move these files to the trash';

// Read the message without instanceof: the rejection crosses the preload bridge.
const messageOf = (err: unknown): string =>
  typeof err === 'object' && err !== null && 'message' in err ? String(err.message) : String(err);

export function DeleteDialog({ item, onClose }: { item: LibraryItem; onClose: () => void }) {
  const t = useT();
  const pushToast = useUi((s) => s.pushToast);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const remove = async (deleteFiles: boolean): Promise<void> => {
    setBusy(true);
    try {
      const { order, removeAt } = usePlayer.getState();
      const index = order.indexOf(item.id);
      if (index >= 0) removeAt(index);
      await window.downtube.library.remove(item.id, deleteFiles);
      onClose();
    } catch (err) {
      // A rejection can come after main already removed the entry, so close instead of leaving live buttons on a deleted item.
      const removed = messageOf(err).includes(PARTIAL_REMOVAL) || !useLibrary.getState().items.some((i) => i.id === item.id);
      if (removed) {
        onClose();
        pushToast({ message: t('delete.partial'), tone: 'error' });
      } else {
        pushToast({ message: t('error.UNKNOWN'), tone: 'error' });
        setBusy(false);
      }
    }
  };

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog dialog-sm" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
        <div className="dialog-header">
          <h2 id="delete-title" className="dialog-title">
            {t('delete.title', { title: item.title })}
          </h2>
        </div>
        <div className="dialog-body">
          <p className="muted" style={{ margin: 0 }}>
            {t('delete.body')}
          </p>
        </div>
        <div className="dialog-footer">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void remove(false)}>
            {t('delete.libraryOnly')}
          </button>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void remove(true)}>
            {t('delete.withFile')}
          </button>
        </div>
      </div>
    </div>
  );
}
