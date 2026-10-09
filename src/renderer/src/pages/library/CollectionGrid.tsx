import type { Collection } from '@shared/types';
import { Thumb } from '../../components/Thumb';
import { useT } from '../../i18n';
import { coverUrl } from '../../lib/media-url';

export function CollectionGrid({ collections, onOpen }: { collections: readonly Collection[]; onOpen: (id: string) => void }) {
  const t = useT();
  return (
    <div className="grid">
      {collections.map((collection) => (
        <article key={collection.id} className="card card-collection">
          <button type="button" className="card-thumb" aria-label={collection.title} onClick={() => onOpen(collection.id)}>
            <Thumb src={collection.thumbPath ? coverUrl(collection.id) : undefined} className="card-img" />
            <span className="card-duration">{t('library.items', { count: collection.itemIds.length })}</span>
          </button>
          <div className="card-body">
            <div className="card-text">
              <div className="card-title">{collection.title}</div>
              <div className="card-meta">
                {collection.kind === 'channel' ? t('library.collection.channel') : t('library.collection.playlist')}
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
