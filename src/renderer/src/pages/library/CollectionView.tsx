import { ChevronLeft, Play, Shuffle } from 'lucide-react';
import { useMemo } from 'react';
import type { Collection, LibraryItem } from '@shared/types';
import { Thumb } from '../../components/Thumb';
import { useT } from '../../i18n';
import { coverUrl } from '../../lib/media-url';
import { usePlayer } from '../../stores/player';
import { collectionItems } from './library-logic';
import { MediaCard } from './MediaCard';
import type { ItemActions } from './use-item-actions';

export function CollectionView({
  collection,
  items,
  onBack,
  onMenu,
  actions,
}: {
  collection: Collection;
  items: readonly LibraryItem[];
  onBack: () => void;
  onMenu: (item: LibraryItem, x: number, y: number) => void;
  actions: ItemActions;
}) {
  const t = useT();
  const list = useMemo(() => collectionItems(collection, items), [collection, items]);
  const audioIds = list.filter((item) => item.kind === 'audio' && !item.missing).map((item) => item.id);
  const firstVideo = list.find((item) => item.kind === 'video' && !item.missing);

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
          <div className="music-actions">
            {audioIds.length > 0 && (
              <>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => usePlayer.getState().playItems(audioIds)}>
                  <Play size={14} aria-hidden="true" />
                  {t('library.playAll')}
                </button>
                <button type="button" className="btn btn-sm" onClick={() => usePlayer.getState().playItems(audioIds, 0, { shuffle: true })}>
                  <Shuffle size={14} aria-hidden="true" />
                  {t('library.shuffleAll')}
                </button>
              </>
            )}
            {audioIds.length === 0 && firstVideo && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => actions.play(firstVideo, list)}>
                <Play size={14} aria-hidden="true" />
                {t('menu.play')}
              </button>
            )}
          </div>
        </div>
      </header>
      <div className="grid">
        {list.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            onPlay={(target) => actions.play(target, list)}
            onMenu={onMenu}
            onRedownload={actions.redownload}
            onRemoveMissing={actions.removeEntry}
          />
        ))}
      </div>
    </>
  );
}
