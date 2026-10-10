import { Ellipsis, Play, Volume2 } from 'lucide-react';
import type { LibraryItem } from '@shared/types';
import { LibraryThumb } from '../../components/LibraryThumb';
import { useT } from '../../i18n';
import { formatDuration } from '../../lib/format';
import { menuPoint } from '../../lib/menu-point';
import { usePlayer } from '../../stores/player';
import type { Modifiers } from './use-selection';

export function MusicList({
  items,
  onPlay,
  onMenu,
  selectedIds,
  onSelectClick,
}: {
  items: readonly LibraryItem[];
  onPlay: (item: LibraryItem) => void;
  onMenu: (item: LibraryItem, x: number, y: number) => void;
  selectedIds?: ReadonlySet<string>;
  /** Ctrl/Shift+click on a row selects it; returns true when handled. */
  onSelectClick?: (item: LibraryItem, modifiers: Modifiers) => boolean;
}) {
  const t = useT();
  const currentId = usePlayer((s) => s.order[s.index]);
  const playing = usePlayer((s) => s.playing);
  return (
    <div className="tracklist" role="table" aria-label={t('library.tab.music')}>
      <div className="track track-head" role="row">
        <span role="columnheader">#</span>
        <span />
        <span role="columnheader">{t('library.col.title')}</span>
        <span role="columnheader">{t('library.col.artist')}</span>
        <span role="columnheader" className="track-duration">
          {t('library.col.duration')}
        </span>
        <span />
      </div>
      {items.map((item, index) => {
        const isCurrent = item.id === currentId;
        return (
          <div
            key={item.id}
            role="row"
            className={`track${isCurrent ? ' is-current' : ''}${item.missing ? ' is-missing' : ''}${selectedIds?.has(item.id) ? ' is-selected' : ''}`}
            aria-selected={selectedIds?.has(item.id) || undefined}
            onClickCapture={(event) => {
              if (!(event.ctrlKey || event.metaKey || event.shiftKey) || !onSelectClick?.(item, event)) return;
              event.preventDefault();
              event.stopPropagation();
            }}
            onDoubleClick={() => onPlay(item)}
            onContextMenu={(event) => {
              event.preventDefault();
              const at = menuPoint(event);
              onMenu(item, at.x, at.y);
            }}
          >
            <span className="track-index">
              <span className="track-num">{isCurrent && playing ? <Volume2 size={14} aria-hidden="true" /> : index + 1}</span>
              <button
                type="button"
                className="track-play"
                aria-label={`${t('menu.play')}: ${item.title}`}
                disabled={item.missing}
                onClick={() => onPlay(item)}
              >
                <Play size={14} aria-hidden="true" />
              </button>
            </span>
            <LibraryThumb item={item} className="track-cover" />
            <span className="track-title" title={item.title}>
              {item.title}
            </span>
            <span className="track-artist">{item.missing ? t('library.missing') : (item.artist ?? item.channel)}</span>
            <span className="track-duration">{formatDuration(item.durationSec)}</span>
            <button
              type="button"
              className="icon-btn track-more"
              aria-label={t('library.more')}
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                onMenu(item, rect.left, rect.bottom);
              }}
            >
              <Ellipsis size={16} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
