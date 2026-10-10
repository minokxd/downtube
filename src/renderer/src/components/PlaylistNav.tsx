import { Pencil, Plus, Smile, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { PLAYLIST_TITLE_MAX } from '@shared/playlist-ops';
import type { Playlist } from '@shared/types';
import { useLocale, useT } from '../i18n';
import { menuPoint } from '../lib/menu-point';
import { sortPlaylists } from '../lib/playlists';
import { usePlaylistActions } from '../lib/use-playlist-actions';
import { useLibrary } from '../stores/library';
import { useUi } from '../stores/ui';
import { ConfirmDialog } from './ConfirmDialog';
import { ContextMenu } from './ContextMenu';
import { EmojiPicker } from './EmojiPicker';
import { PlaylistIcon } from './PlaylistIcon';
import './playlist-nav.css';

interface RowMenu {
  playlist: Playlist;
  x: number;
  y: number;
  mode: 'actions' | 'emoji';
}

/** An inline name field. Enter or leaving the field submits; Escape cancels. It submits or cancels exactly once. */
function NameInput({
  initial,
  emoji,
  label,
  placeholder,
  onSubmit,
  onCancel,
}: {
  initial: string;
  emoji?: string;
  label: string;
  placeholder?: string;
  onSubmit: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const finish = (submit: boolean): void => {
    if (done.current) return;
    done.current = true;
    if (submit) onSubmit(value.trim());
    else onCancel();
  };
  return (
    <div className="playlist-row is-editing">
      <PlaylistIcon emoji={emoji} />
      <input
        className="playlist-row-input"
        value={value}
        maxLength={PLAYLIST_TITLE_MAX}
        aria-label={label}
        placeholder={placeholder}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') finish(true);
          else if (event.key === 'Escape') {
            // Keep Escape from also clearing the library selection or closing other layers.
            event.stopPropagation();
            finish(false);
          }
        }}
        onBlur={() => finish(true)}
      />
    </div>
  );
}

export function PlaylistNav() {
  const t = useT();
  const locale = useLocale();
  const playlists = useLibrary((s) => s.playlists);
  const page = useUi((s) => s.page);
  const view = useUi((s) => s.libraryView);
  const openLibraryView = useUi((s) => s.openLibraryView);
  const newPlaylist = useUi((s) => s.newPlaylist);
  const startNewPlaylist = useUi((s) => s.startNewPlaylist);
  const endNewPlaylist = useUi((s) => s.endNewPlaylist);
  const actions = usePlaylistActions();
  const [menu, setMenu] = useState<RowMenu | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Playlist | null>(null);
  const sorted = useMemo(() => sortPlaylists(playlists, locale), [playlists, locale]);
  const closeMenu = useCallback(() => setMenu(null), []);
  const closeDelete = useCallback(() => setToDelete(null), []);

  const create = async (title: string): Promise<void> => {
    const pending = useUi.getState().newPlaylist?.itemIds ?? [];
    endNewPlaylist();
    const playlist = await actions.create(title);
    if (playlist && pending.length > 0) actions.addItems(playlist, pending);
  };

  return (
    <section className="playlist-nav" aria-labelledby="playlist-nav-title">
      <div className="playlist-nav-head">
        <span id="playlist-nav-title" className="playlist-nav-title">
          {t('nav.playlists')}
        </span>
        <button type="button" className="icon-btn playlist-nav-add" aria-label={t('playlist.new')} onClick={() => startNewPlaylist()}>
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      <ul className="playlist-nav-list">
        {sorted.map((playlist) => {
          const active = page === 'library' && view?.type === 'playlist' && view.id === playlist.id;
          return (
            <li key={playlist.id}>
              {renamingId === playlist.id ? (
                <NameInput
                  initial={playlist.title}
                  emoji={playlist.emoji}
                  label={t('playlist.rename')}
                  onSubmit={(title) => {
                    setRenamingId(null);
                    if (title && title !== playlist.title) actions.rename(playlist.id, title);
                  }}
                  onCancel={() => setRenamingId(null)}
                />
              ) : (
                <button
                  type="button"
                  className={`playlist-row${active ? ' is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => openLibraryView({ type: 'playlist', id: playlist.id })}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    const at = menuPoint(event);
                    setMenu({ playlist, x: at.x, y: at.y, mode: 'actions' });
                  }}
                >
                  <PlaylistIcon emoji={playlist.emoji} />
                  <span className="playlist-row-title">{playlist.title}</span>
                  <span className="playlist-row-count">{playlist.itemIds.length}</span>
                </button>
              )}
            </li>
          );
        })}
        {newPlaylist && (
          <li>
            <NameInput
              initial=""
              label={t('playlist.new')}
              placeholder={t('playlist.namePlaceholder')}
              onSubmit={(title) => {
                if (title) void create(title);
                else endNewPlaylist();
              }}
              onCancel={endNewPlaylist}
            />
          </li>
        )}
      </ul>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} onClose={closeMenu} className={menu.mode === 'emoji' ? 'emoji-menu' : undefined} contentKey={menu.mode}>
          {menu.mode === 'actions' ? (
            <>
              <button type="button" role="menuitem" onClick={() => setMenu({ ...menu, mode: 'emoji' })}>
                <Smile size={14} aria-hidden="true" />
                {t('playlist.chooseEmoji')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setRenamingId(menu.playlist.id);
                  setMenu(null);
                }}
              >
                <Pencil size={14} aria-hidden="true" />
                {t('playlist.rename')}
              </button>
              <div className="menu-sep" />
              <button
                type="button"
                role="menuitem"
                className="is-danger"
                onClick={() => {
                  setToDelete(menu.playlist);
                  setMenu(null);
                }}
              >
                <Trash2 size={14} aria-hidden="true" />
                {t('playlist.delete')}
              </button>
            </>
          ) : (
            <EmojiPicker
              value={menu.playlist.emoji}
              onPick={(emoji) => {
                actions.setEmoji(menu.playlist.id, emoji);
                setMenu(null);
              }}
            />
          )}
        </ContextMenu>
      )}
      {toDelete && (
        <ConfirmDialog
          title={t('playlist.deleteTitle', { title: toDelete.title })}
          body={t('playlist.deleteBody')}
          confirmLabel={t('playlist.deleteConfirm')}
          onConfirm={() => actions.remove(toDelete.id)}
          onClose={closeDelete}
        />
      )}
    </section>
  );
}
