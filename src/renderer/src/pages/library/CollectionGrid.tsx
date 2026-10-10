import { useMemo } from 'react';
import type { Collection, LibraryItem, Playlist } from '@shared/types';
import { LibraryThumb } from '../../components/LibraryThumb';
import { PlaylistIcon } from '../../components/PlaylistIcon';
import { Thumb } from '../../components/Thumb';
import { useT } from '../../i18n';
import { coverUrl } from '../../lib/media-url';
import { coverItem } from '../../lib/playlists';

export function CollectionGrid({
  playlists,
  collections,
  items,
  onOpenPlaylist,
  onOpenCollection,
}: {
  playlists: readonly Playlist[];
  collections: readonly Collection[];
  items: readonly LibraryItem[];
  onOpenPlaylist: (id: string) => void;
  onOpenCollection: (id: string) => void;
}) {
  const t = useT();
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  return (
    <>
      {playlists.length > 0 && (
        <section className="library-section">
          <h2 className="library-section-title">{t('nav.playlists')}</h2>
          <div className="grid">
            {playlists.map((playlist) => {
              const cover = playlist.emoji
                ? undefined
                : coverItem(playlist.itemIds.map((id) => byId.get(id)).filter((item): item is LibraryItem => item !== undefined));
              return (
                <article key={playlist.id} className="card card-collection">
                  <button type="button" className="card-thumb" aria-label={playlist.title} onClick={() => onOpenPlaylist(playlist.id)}>
                    {playlist.emoji ? (
                      <span className="card-img card-emoji" aria-hidden="true">
                        {playlist.emoji}
                      </span>
                    ) : cover ? (
                      <LibraryThumb item={cover} className="card-img" />
                    ) : (
                      <span className="card-img card-emoji" aria-hidden="true">
                        <PlaylistIcon size={32} />
                      </span>
                    )}
                    <span className="card-duration">{t('library.items', { count: playlist.itemIds.length })}</span>
                  </button>
                  <div className="card-body">
                    <div className="card-text">
                      <div className="card-title">{playlist.title}</div>
                      <div className="card-meta">{t('playlist.badge')}</div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      {collections.length > 0 && (
        <section className="library-section">
          <h2 className="library-section-title">{t('library.section.youtube')}</h2>
          <div className="grid">
            {collections.map((collection) => (
              <article key={collection.id} className="card card-collection">
                <button type="button" className="card-thumb" aria-label={collection.title} onClick={() => onOpenCollection(collection.id)}>
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
        </section>
      )}
    </>
  );
}
