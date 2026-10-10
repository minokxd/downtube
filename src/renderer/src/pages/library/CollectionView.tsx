import { ChevronLeft, Play, Shuffle } from 'lucide-react';
import { useMemo } from 'react';
import type { Collection, LibraryItem } from '@shared/types';
import { Thumb } from '../../components/Thumb';
import { useT } from '../../i18n';
import { coverUrl } from '../../lib/media-url';
import { collectionItems } from './library-logic';
import { MediaCard } from './MediaCard';
import type { ItemActions } from './use-item-actions';
import type { Modifiers } from './use-selection';

export function CollectionView({
  collection,
  items,
  onBack,
  onMenu,
  actions,
  selectedIds,
  onSelectClick,
}: {
  collection: Collection;
  items: readonly LibraryItem[];
  onBack: () => void;
  onMenu: (item: LibraryItem, x: number, y: number) => void;
  actions: ItemActions;
  selectedIds: ReadonlySet<string>;
  onSelectClick: (item: LibraryItem, modifiers: Modifiers) => boolean;
}) {
  const t = useT();
  const list = useMemo(() => collectionItems(collection, items), [collection, items]);
  const playable = list.some((item) => !item.missing);

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm collection-back" onClick={onBack}>
        <ChevronLeft size={16} aria-hidden="true" />
        {t('library.back')}
      </button>
      <header className="collection-header">
        <Thumb src={collection.thumbPath ? coverUrl(collection.id) : undefined} className="collection-cover" />
        <div className="collection-info">
          <span className="badge">{collection.kind === 'channel' ? t('library.collection.channel') : t('library.collection.playlist')}</span>
          <h1 className="page-title">{collection.title}</h1>
          <p className="muted">{t('library.items', { count: list.length })}</p>
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
      <div className="grid">
        {list.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            selected={selectedIds.has(item.id)}
            onSelectClick={onSelectClick}
            onPlay={(target) => actions.play(target, list, { sequence: true })}
            onMenu={onMenu}
            onRedownload={actions.redownload}
            onRemoveMissing={actions.removeEntry}
          />
        ))}
      </div>
    </>
  );
}
