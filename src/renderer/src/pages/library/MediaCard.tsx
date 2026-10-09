import { CircleAlert, Ellipsis, Music, Play } from 'lucide-react';
import type { LibraryItem } from '@shared/types';
import { LibraryThumb } from '../../components/LibraryThumb';
import { useT } from '../../i18n';
import { formatDuration } from '../../lib/format';
import { resumeRatio } from './library-logic';

export interface MediaCardProps {
  item: LibraryItem;
  onPlay: (item: LibraryItem) => void;
  onMenu: (item: LibraryItem, x: number, y: number) => void;
  onRedownload: (item: LibraryItem) => void;
  onRemoveMissing: (item: LibraryItem) => void;
}

export function MediaCard({ item, onPlay, onMenu, onRedownload, onRemoveMissing }: MediaCardProps) {
  const t = useT();
  const ratio = resumeRatio(item);
  return (
    <article
      className={`card${item.missing ? ' is-missing' : ''}`}
      onContextMenu={(event) => {
        event.preventDefault();
        onMenu(item, event.clientX, event.clientY);
      }}
    >
      <button
        type="button"
        className="card-thumb"
        disabled={item.missing}
        aria-label={`${t('menu.play')}: ${item.title}`}
        onClick={() => onPlay(item)}
      >
        <LibraryThumb item={item} className="card-img" />
        <span className="card-duration">{formatDuration(item.durationSec)}</span>
        {item.kind === 'audio' && (
          <span className="card-kind">
            <Music size={11} aria-hidden="true" /> MP3
          </span>
        )}
        {ratio > 0 && <span className="card-resume" style={{ width: `${ratio * 100}%` }} />}
        {!item.missing && (
          <span className="card-play" aria-hidden="true">
            <Play size={18} />
          </span>
        )}
      </button>
      {item.missing && (
        <div className="card-missing">
          <span className="card-missing-label">
            <CircleAlert size={14} aria-hidden="true" />
            {t('library.missing')}
          </span>
          <div className="card-missing-actions">
            <button type="button" className="btn btn-sm" onClick={() => onRedownload(item)}>
              {t('library.redownload')}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onRemoveMissing(item)}>
              {t('library.removeEntry')}
            </button>
          </div>
        </div>
      )}
      <div className="card-body">
        <div className="card-text">
          <div className="card-title" title={item.title}>
            {item.title}
          </div>
          <div className="card-meta">{item.kind === 'audio' ? (item.artist ?? item.channel) : item.channel}</div>
        </div>
        <button
          type="button"
          className="icon-btn card-more"
          aria-label={t('library.more')}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            onMenu(item, rect.left, rect.bottom);
          }}
        >
          <Ellipsis size={16} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
