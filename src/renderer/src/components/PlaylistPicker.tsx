import { ChevronLeft, Plus } from 'lucide-react';
import { useMemo } from 'react';
import type { Playlist } from '@shared/types';
import { useLocale, useT } from '../i18n';
import { sortPlaylists } from '../lib/playlists';
import { useLibrary } from '../stores/library';
import { PlaylistIcon } from './PlaylistIcon';

/** Menu content: the user's playlists plus "New playlist…", for adding items to one. */
export function PlaylistPicker({ onPick, onNew, onBack }: { onPick: (playlist: Playlist) => void; onNew: () => void; onBack?: () => void }) {
  const t = useT();
  const locale = useLocale();
  const playlists = useLibrary((s) => s.playlists);
  const sorted = useMemo(() => sortPlaylists(playlists, locale), [playlists, locale]);
  return (
    <>
      {onBack && (
        <>
          <button type="button" role="menuitem" onClick={onBack}>
            <ChevronLeft size={14} aria-hidden="true" />
            {t('library.back')}
          </button>
          <div className="menu-sep" />
        </>
      )}
      {sorted.map((playlist) => (
        <button key={playlist.id} type="button" role="menuitem" onClick={() => onPick(playlist)}>
          <PlaylistIcon emoji={playlist.emoji} size={14} />
          <span className="menu-label">{playlist.title}</span>
        </button>
      ))}
      {sorted.length > 0 && <div className="menu-sep" />}
      <button type="button" role="menuitem" onClick={onNew}>
        <Plus size={14} aria-hidden="true" />
        {t('playlist.newEllipsis')}
      </button>
    </>
  );
}
