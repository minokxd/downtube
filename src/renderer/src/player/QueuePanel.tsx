import { ArrowDown, ArrowUp, Volume2, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useT } from '../i18n';
import { useLibrary } from '../stores/library';
import { usePlayer } from '../stores/player';

export function QueuePanel() {
  const t = useT();
  const order = usePlayer((s) => s.order);
  const index = usePlayer((s) => s.index);
  const items = useLibrary((s) => s.items);
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const player = usePlayer.getState();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') usePlayer.getState().setQueueOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="queue-panel" role="dialog" aria-label={t('player.queue')}>
      <div className="queue-head">
        <span>{t('player.queue')}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={player.clear}>
          {t('player.clearQueue')}
        </button>
      </div>
      <ol className="queue-list">
        {order.map((id, i) => {
          const item = byId.get(id);
          return (
            <li key={id} className={`queue-row${i === index ? ' is-current' : ''}`}>
              <button type="button" className="queue-main" onClick={() => player.jumpTo(i)}>
                <span className="queue-index">{i === index ? <Volume2 size={13} aria-hidden="true" /> : i + 1}</span>
                <span className="queue-title">{item?.title ?? id}</span>
                <span className="queue-artist">{item ? (item.artist ?? item.channel) : ''}</span>
              </button>
              <div className="queue-actions">
                <button type="button" className="icon-btn" aria-label={t('player.moveUp')} disabled={i === 0} onClick={() => player.move(i, -1)}>
                  <ArrowUp size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('player.moveDown')}
                  disabled={i === order.length - 1}
                  onClick={() => player.move(i, 1)}
                >
                  <ArrowDown size={14} aria-hidden="true" />
                </button>
                <button type="button" className="icon-btn" aria-label={t('player.removeFromQueue')} onClick={() => player.removeAt(i)}>
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
