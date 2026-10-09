import { ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { useMemo, type CSSProperties } from 'react';
import { LibraryThumb } from '../components/LibraryThumb';
import { useT, type MessageKey } from '../i18n';
import { formatDuration } from '../lib/format';
import { useLibrary } from '../stores/library';
import { usePlayer } from '../stores/player';
import type { RepeatMode } from './queue-logic';
import { QueuePanel } from './QueuePanel';
import './player.css';

const REPEAT_LABEL: Record<RepeatMode, MessageKey> = {
  off: 'player.repeat.off',
  all: 'player.repeat.all',
  one: 'player.repeat.one',
};

const fill = (percent: number): CSSProperties => ({ '--fill': `${percent}%` }) as CSSProperties;

export function MusicBar() {
  const t = useT();
  const order = usePlayer((s) => s.order);
  const index = usePlayer((s) => s.index);
  const playing = usePlayer((s) => s.playing);
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const queueOpen = usePlayer((s) => s.queueOpen);
  const items = useLibrary((s) => s.items);
  const currentId = order[index];
  const item = useMemo(() => items.find((i) => i.id === currentId), [items, currentId]);

  if (order.length === 0) return null;

  const player = usePlayer.getState();
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const shownVolume = muted ? 0 : volume;
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;

  return (
    <footer className="musicbar">
      <div className="musicbar-track">
        {item ? <LibraryThumb item={item} className="musicbar-cover" /> : <div className="musicbar-cover thumb-fallback" />}
        <div className="musicbar-text">
          <div className="musicbar-title" title={item?.title}>
            {item?.title ?? '—'}
          </div>
          <div className="musicbar-artist">{item ? (item.artist ?? item.channel) : ''}</div>
        </div>
      </div>

      <div className="musicbar-center">
        <div className="musicbar-controls">
          <button
            type="button"
            className={`icon-btn${shuffle ? ' is-on' : ''}`}
            aria-pressed={shuffle}
            aria-label={t('player.shuffle')}
            title={t('player.shuffle')}
            onClick={player.toggleShuffle}
          >
            <Shuffle size={16} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" aria-label={t('player.previous')} onClick={player.previous}>
            <SkipBack size={18} aria-hidden="true" />
          </button>
          <button type="button" className="play-btn" aria-label={playing ? t('player.pause') : t('player.play')} onClick={player.toggle}>
            {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
          </button>
          <button type="button" className="icon-btn" aria-label={t('player.next')} onClick={player.next}>
            <SkipForward size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`icon-btn${repeat !== 'off' ? ' is-on' : ''}`}
            aria-label={t(REPEAT_LABEL[repeat])}
            title={t(REPEAT_LABEL[repeat])}
            onClick={player.cycleRepeat}
          >
            <RepeatIcon size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="musicbar-seek">
          <span className="time">{formatDuration(currentTime)}</span>
          <input
            type="range"
            className="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            style={fill(progress)}
            onChange={(event) => player.seek(Number(event.target.value))}
            aria-label={t('player.seek')}
          />
          <span className="time">{formatDuration(duration)}</span>
        </div>
      </div>

      <div className="musicbar-side">
        <button type="button" className="icon-btn" aria-label={t('player.mute')} onClick={player.toggleMute}>
          {shownVolume === 0 ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
        </button>
        <input
          type="range"
          className="range range-volume"
          min={0}
          max={1}
          step={0.01}
          value={shownVolume}
          style={fill(shownVolume * 100)}
          onChange={(event) => player.setVolume(Number(event.target.value))}
          aria-label={t('player.volume')}
        />
        <button
          type="button"
          className={`icon-btn${queueOpen ? ' is-on' : ''}`}
          aria-pressed={queueOpen}
          aria-label={t('player.queue')}
          onClick={() => player.setQueueOpen(!queueOpen)}
        >
          <ListMusic size={16} aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn" aria-label={t('player.close')} onClick={player.clear}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {queueOpen && <QueuePanel />}
    </footer>
  );
}
