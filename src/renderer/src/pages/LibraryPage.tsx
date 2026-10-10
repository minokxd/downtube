import { Play, Search, Shuffle, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react';
import type { LibraryItem, Playlist } from '@shared/types';
import { ContextMenu } from '../components/ContextMenu';
import { PlaylistPicker } from '../components/PlaylistPicker';
import { useLocale, useT, type MessageKey } from '../i18n';
import { setCountDragImage, writeDragItems } from '../lib/drag';
import { stepAnchor } from '../lib/playlists';
import { usePlaylistActions } from '../lib/use-playlist-actions';
import { useLibrary } from '../stores/library';
import { usePlayer } from '../stores/player';
import { useUi } from '../stores/ui';
import { CollectionGrid } from './library/CollectionGrid';
import { CollectionView } from './library/CollectionView';
import { DeleteDialog } from './library/DeleteDialog';
import { ItemMenu, type ItemMenuPlaylist } from './library/ItemMenu';
import { collectionItems, filterCollections, filterItems, type LibrarySort, type LibraryTab } from './library/library-logic';
import { MediaCard } from './library/MediaCard';
import { MusicList } from './library/MusicList';
import { PlaylistView } from './library/PlaylistView';
import { SelectionBar } from './library/SelectionBar';
import { useItemActions } from './library/use-item-actions';
import { useSelection, type Modifiers } from './library/use-selection';
import './library/library.css';

const TABS: ReadonlyArray<{ id: LibraryTab; label: MessageKey }> = [
  { id: 'all', label: 'library.tab.all' },
  { id: 'video', label: 'library.tab.video' },
  { id: 'music', label: 'library.tab.music' },
  { id: 'collections', label: 'library.tab.collections' },
];

interface MenuState {
  item: LibraryItem;
  x: number;
  y: number;
}

export function LibraryPage() {
  const t = useT();
  const locale = useLocale();
  const items = useLibrary((s) => s.items);
  const collections = useLibrary((s) => s.collections);
  const playlists = useLibrary((s) => s.playlists);
  const loaded = useLibrary((s) => s.loaded);
  const view = useUi((s) => s.libraryView);
  const openLibraryView = useUi((s) => s.openLibraryView);
  const closeLibraryView = useUi((s) => s.closeLibraryView);
  const [tab, setTab] = useState<LibraryTab>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<LibrarySort>('newest');
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [toDelete, setToDelete] = useState<LibraryItem | null>(null);
  const actions = useItemActions();
  const playlistActions = usePlaylistActions();
  const startNewPlaylist = useUi((s) => s.startNewPlaylist);
  const [pickerAt, setPickerAt] = useState<{ x: number; y: number } | null>(null);

  const visible = useMemo(() => filterItems(items, tab, query, sort, locale), [items, tab, query, sort, locale]);
  const visibleCollections = useMemo(() => filterCollections(collections, query, locale), [collections, query, locale]);
  const visiblePlaylists = useMemo(() => filterCollections(playlists, query, locale), [playlists, query, locale]);
  const openCollection = view?.type === 'collection' ? collections.find((c) => c.id === view.id) : undefined;
  const openPlaylist = view?.type === 'playlist' ? playlists.find((p) => p.id === view.id) : undefined;
  const context = useMemo(() => {
    const group = openPlaylist ?? openCollection;
    return group ? collectionItems(group, items) : visible;
  }, [openPlaylist, openCollection, items, visible]);
  const musicIds = useMemo(() => visible.filter((i) => i.kind === 'audio' && !i.missing).map((i) => i.id), [visible]);
  const openMenu = useCallback((item: LibraryItem, x: number, y: number) => setMenu({ item, x, y }), []);
  const closeMenu = useCallback(() => setMenu(null), []);
  const closeDelete = useCallback(() => setToDelete(null), []);
  const order = useMemo(() => context.map((item) => item.id), [context]);
  const selection = useSelection(order, `${tab}|${query}|${view?.type ?? ''}:${view?.id ?? ''}`);
  const selectedIds = useMemo(() => order.filter((id) => selection.ids.has(id)), [order, selection.ids]);
  const selectClick = useCallback((item: LibraryItem, modifiers: Modifiers) => selection.click(item.id, modifiers), [selection]);
  const closePicker = useCallback(() => setPickerAt(null), []);
  // Dragging a selected item takes the whole selection along.
  const startDrag = useCallback(
    (item: LibraryItem, event: DragEvent<HTMLElement>) => {
      const ids = selection.targets(item.id);
      writeDragItems(event.dataTransfer, ids);
      if (ids.length > 1) setCountDragImage(event.dataTransfer, t('library.items', { count: ids.length }));
    },
    [selection, t],
  );

  const playlistMenu = (playlist: Playlist, item: LibraryItem): ItemMenuPlaylist => {
    const earlier = stepAnchor(playlist.itemIds, item.id, -1);
    const later = stepAnchor(playlist.itemIds, item.id, 1);
    return {
      onRemove: () => playlistActions.removeItems(playlist.id, selection.targets(item.id)),
      onMoveEarlier: earlier === undefined ? undefined : () => playlistActions.moveItems(playlist.id, [item.id], earlier),
      onMoveLater: later === undefined ? undefined : () => playlistActions.moveItems(playlist.id, [item.id], later),
    };
  };

  // A deleted playlist, or a YouTube collection that emptied out, closes its page.
  useEffect(() => {
    if (loaded && view && !openCollection && !openPlaylist) closeLibraryView();
  }, [loaded, view, openCollection, openPlaylist, closeLibraryView]);

  if (loaded && items.length === 0 && !openPlaylist) {
    return (
      <div className="page">
        <div className="empty">
          <div>
            <div className="empty-icon">
              <Sparkles size={24} aria-hidden="true" />
            </div>
            <h2>{t('library.empty.title')}</h2>
            <p>{t('library.empty.body')}</p>
          </div>
        </div>
      </div>
    );
  }

  let content: ReactNode;
  if (tab === 'collections') {
    content =
      visibleCollections.length === 0 && visiblePlaylists.length === 0 ? (
        <p className="library-noresults">
          {collections.length === 0 && playlists.length === 0 ? t('library.noCollections') : t('library.noResults')}
        </p>
      ) : (
        <CollectionGrid
          playlists={visiblePlaylists}
          collections={visibleCollections}
          items={items}
          onOpenPlaylist={(id) => openLibraryView({ type: 'playlist', id })}
          onOpenCollection={(id) => openLibraryView({ type: 'collection', id })}
        />
      );
  } else if (visible.length === 0) {
    content = <p className="library-noresults">{t('library.noResults')}</p>;
  } else if (tab === 'music') {
    content = (
      <>
        <div className="music-actions">
          <button type="button" className="btn btn-primary btn-sm" disabled={musicIds.length === 0} onClick={() => usePlayer.getState().playItems(musicIds)}>
            <Play size={14} aria-hidden="true" />
            {t('library.playAll')}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={musicIds.length === 0}
            onClick={() => usePlayer.getState().playItems(musicIds, 0, { shuffle: true })}
          >
            <Shuffle size={14} aria-hidden="true" />
            {t('library.shuffleAll')}
          </button>
        </div>
        <MusicList
          items={visible}
          onPlay={(item) => actions.play(item, visible)}
          onMenu={openMenu}
          selectedIds={selection.ids}
          onSelectClick={selectClick}
          onDragStart={startDrag}
        />
      </>
    );
  } else {
    content = (
      <div className="grid">
        {visible.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            selected={selection.ids.has(item.id)}
            onSelectClick={selectClick}
            onDragStart={startDrag}
            onPlay={(target) => actions.play(target, visible)}
            onMenu={openMenu}
            onRedownload={actions.redownload}
            onRemoveMissing={actions.removeEntry}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="page library">
      {selectedIds.length > 0 && (
        <SelectionBar
          count={selectedIds.length}
          onAddTo={(x, y) => setPickerAt({ x, y })}
          onRemoveFromPlaylist={openPlaylist ? () => playlistActions.removeItems(openPlaylist.id, selectedIds) : undefined}
          onClear={selection.clear}
        />
      )}
      {openPlaylist ? (
        <PlaylistView
          playlist={openPlaylist}
          items={items}
          onBack={closeLibraryView}
          onMenu={openMenu}
          actions={actions}
          selectedIds={selection.ids}
          onSelectClick={selectClick}
          onDragStart={startDrag}
        />
      ) : openCollection ? (
        <CollectionView
          collection={openCollection}
          items={items}
          onBack={closeLibraryView}
          onMenu={openMenu}
          actions={actions}
          selectedIds={selection.ids}
          onSelectClick={selectClick}
          onDragStart={startDrag}
        />
      ) : (
        <>
          <div className="page-header">
            <h1 className="page-title">{t('library.title')}</h1>
          </div>
          <div className="library-toolbar">
            <div className="tabs" role="tablist" aria-label={t('library.title')}>
              {TABS.map(({ id, label }) => (
                <button key={id} type="button" role="tab" className="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                  {t(label)}
                </button>
              ))}
            </div>
            <div className="library-tools">
              <label className="search">
                <Search size={14} aria-hidden="true" />
                <input
                  className="search-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('library.search')}
                  aria-label={t('library.search')}
                  spellCheck={false}
                />
              </label>
              {tab !== 'collections' && (
                <select className="select" value={sort} onChange={(event) => setSort(event.target.value as LibrarySort)} aria-label={t('library.sort')}>
                  <option value="newest">{t('library.sort.newest')}</option>
                  <option value="title">{t('library.sort.title')}</option>
                </select>
              )}
            </div>
          </div>
          {content}
        </>
      )}
      {menu && (
        <ItemMenu
          item={menu.item}
          x={menu.x}
          y={menu.y}
          targetIds={selection.targets(menu.item.id)}
          playlist={openPlaylist ? playlistMenu(openPlaylist, menu.item) : undefined}
          onClose={closeMenu}
          onPlay={(item) => actions.play(item, context, { sequence: openPlaylist !== undefined || openCollection !== undefined })}
          onEnqueue={actions.enqueue}
          onShowInFolder={actions.showInFolder}
          onDelete={setToDelete}
        />
      )}
      {toDelete && <DeleteDialog item={toDelete} onClose={closeDelete} />}
      {pickerAt && (
        <ContextMenu x={pickerAt.x} y={pickerAt.y} onClose={closePicker}>
          <PlaylistPicker
            onPick={(target) => {
              playlistActions.addItems(target, selectedIds);
              closePicker();
            }}
            onNew={() => {
              startNewPlaylist(selectedIds);
              closePicker();
            }}
          />
        </ContextMenu>
      )}
    </div>
  );
}
