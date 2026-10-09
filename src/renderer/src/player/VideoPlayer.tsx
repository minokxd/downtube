import { Captions, ChevronLeft, Gauge, Maximize, Minimize, Pause, PictureInPicture2, Play, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { LibraryItem } from '@shared/types';
import { useLanguage, useT } from '../i18n';
import { formatDuration } from '../lib/format';
import { languageLabel } from '../lib/langs';
import { mediaUrl, subtitleUrl } from '../lib/media-url';
import { useLibrary } from '../stores/library';
import { usePlayer } from '../stores/player';
import { useUi } from '../stores/ui';
import { createProgressSaver } from './progress-saver';
import { resumeStart } from './resume';
import { shortcutAction, type ShortcutAction } from './video-shortcuts';
import './video-player.css';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const IDLE_MS = 2500;
const RESUME_NOTICE_MS = 6000;

const fill = (percent: number): CSSProperties => ({ '--fill': `${percent}%` }) as CSSProperties;

// Before metadata loads, currentTime is 0 and duration is NaN. Saving then would overwrite the stored resume position.
const hasMetadata = (video: HTMLVideoElement): boolean => video.readyState >= HTMLMediaElement.HAVE_METADATA;

export function VideoPlayer() {
  const itemId = useUi((s) => s.videoItemId);
  const item = useLibrary((s) => (itemId ? s.items.find((i) => i.id === itemId) : undefined));
  if (!itemId) return null;
  return <VideoPlayerView key={itemId} itemId={itemId} item={item} />;
}

function VideoPlayerView({ itemId, item }: { itemId: string; item: LibraryItem | undefined }) {
  const t = useT();
  const language = useLanguage();
  const close = useUi((s) => s.closeVideo);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const idleTimer = useRef<number | undefined>(undefined);
  const saver = useMemo(
    () => createProgressSaver((id, position, duration) => void window.downtube.library.saveProgress(id, position, duration)),
    [],
  );
  const [startAt] = useState(() => (item ? resumeStart(item.progress, item.durationSec) : 0));
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(item?.durationSec ?? 0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [menu, setMenu] = useState<'speed' | 'subtitles' | null>(null);
  const [idle, setIdle] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const subtitles = item?.subtitles ?? [];
  const firstSubtitle = subtitles[0]?.lang ?? null;
  const unavailable = !item || Boolean(item.missing) || failed;

  useEffect(() => {
    usePlayer.getState().pause();
    void window.downtube.library.markPlayed(itemId);
  }, [itemId]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    for (const track of Array.from(video.textTracks)) track.mode = track.language === subtitle ? 'showing' : 'disabled';
  }, [subtitle]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (resumedFrom === null) return;
    const timer = window.setTimeout(() => setResumedFrom(null), RESUME_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [resumedFrom]);

  useEffect(() => () => window.clearTimeout(idleTimer.current), []);

  const poke = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
  }, []);

  const closePlayer = useCallback(() => {
    const video = videoRef.current;
    if (video && hasMetadata(video)) saver.flush(itemId, video.currentTime, video.duration);
    if (document.fullscreenElement) void document.exitFullscreen();
    if (document.pictureInPictureElement) void document.exitPictureInPicture();
    close();
  }, [close, itemId, saver]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    const end = Number.isFinite(video.duration) ? video.duration : Number.POSITIVE_INFINITY;
    video.currentTime = Math.max(0, Math.min(end, video.currentTime + delta));
  }, []);

  const changeVolume = useCallback((delta: number) => {
    setMuted(false);
    setVolume((value) => Math.min(1, Math.max(0, Math.round((value + delta) * 100) / 100)));
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen();
  }, []);

  const togglePip = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (document.pictureInPictureElement) void document.exitPictureInPicture();
    else void video.requestPictureInPicture().catch(() => undefined);
  }, []);

  const run = useCallback(
    (action: ShortcutAction) => {
      switch (action) {
        case 'toggle':
          togglePlay();
          break;
        case 'back5':
          seekBy(-5);
          break;
        case 'forward5':
          seekBy(5);
          break;
        case 'back10':
          seekBy(-10);
          break;
        case 'forward10':
          seekBy(10);
          break;
        case 'volumeUp':
          changeVolume(0.05);
          break;
        case 'volumeDown':
          changeVolume(-0.05);
          break;
        case 'fullscreen':
          toggleFullscreen();
          break;
        case 'mute':
          setMuted((value) => !value);
          break;
        case 'subtitles':
          setSubtitle((current) => (current ? null : firstSubtitle));
          break;
        case 'close':
          if (menu) setMenu(null);
          else if (document.fullscreenElement) void document.exitFullscreen();
          else closePlayer();
          break;
      }
      poke();
    },
    [togglePlay, seekBy, changeVolume, toggleFullscreen, closePlayer, poke, firstSubtitle, menu],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const action = shortcutAction(event.key);
      if (!action) return;
      event.preventDefault();
      run(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run]);

  const progress = duration > 0 ? (time / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0;
  const shownVolume = muted ? 0 : volume;

  return (
    <div
      ref={containerRef}
      className={`video-overlay${idle && playing && !menu ? ' is-idle' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={item?.title ?? ''}
      onMouseMove={poke}
    >
      {!unavailable && (
        <video
          ref={videoRef}
          className="video-el"
          src={mediaUrl(itemId)}
          crossOrigin="anonymous"
          autoPlay
          preload="auto"
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            setDuration(Number.isFinite(video.duration) ? video.duration : 0);
            video.playbackRate = speed;
            video.volume = volume;
            video.muted = muted;
            if (startAt > 0) {
              video.currentTime = startAt;
              setResumedFrom(startAt);
            }
          }}
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            setTime(video.currentTime);
            if (hasMetadata(video)) saver.update(itemId, video.currentTime, video.duration);
          }}
          onProgress={(event) => {
            const video = event.currentTarget;
            if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1));
          }}
          onPlay={() => {
            setPlaying(true);
            poke();
          }}
          onPause={(event) => {
            setPlaying(false);
            const video = event.currentTarget;
            if (hasMetadata(video)) saver.flush(itemId, video.currentTime, video.duration);
          }}
          onEnded={(event) => {
            const video = event.currentTarget;
            if (hasMetadata(video)) saver.flush(itemId, video.duration, video.duration);
          }}
          onError={() => setFailed(true)}
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
        >
          {subtitles.map((track) => (
            <track key={track.lang} kind="subtitles" srcLang={track.lang} label={languageLabel(track.lang, language)} src={subtitleUrl(itemId, track.lang)} />
          ))}
        </video>
      )}

      {unavailable && (
        <div className="video-error">
          <p>{!item || item.missing ? t('player.missing') : t('player.mediaError')}</p>
          <button type="button" className="btn" onClick={closePlayer}>
            {t('common.close')}
          </button>
        </div>
      )}

      <div className="video-top">
        <button type="button" className="icon-btn on-video" aria-label={t('player.back')} onClick={closePlayer}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <div className="video-title">{item?.title}</div>
      </div>

      {resumedFrom !== null && (
        <div className="video-resume" role="status">
          <span>{t('player.resumed', { time: formatDuration(resumedFrom) })}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              if (videoRef.current) videoRef.current.currentTime = 0;
              setResumedFrom(null);
            }}
          >
            {t('player.startOver')}
          </button>
        </div>
      )}

      {!unavailable && (
        <div className="video-controls">
          <div className="video-seek">
            <div className="video-buffer" style={{ width: `${bufferedPercent}%` }} />
            <input
              type="range"
              className="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(time, duration || 0)}
              style={fill(progress)}
              onChange={(event) => {
                if (videoRef.current) videoRef.current.currentTime = Number(event.target.value);
              }}
              aria-label={t('player.seek')}
            />
          </div>
          <div className="video-buttons">
            <button type="button" className="icon-btn on-video" aria-label={playing ? t('player.pause') : t('player.play')} onClick={togglePlay}>
              {playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
            </button>
            <button type="button" className="icon-btn on-video" aria-label={t('player.mute')} onClick={() => setMuted((value) => !value)}>
              {shownVolume === 0 ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
            </button>
            <input
              type="range"
              className="range range-volume"
              min={0}
              max={1}
              step={0.01}
              value={shownVolume}
              style={fill(shownVolume * 100)}
              onChange={(event) => {
                setMuted(false);
                setVolume(Number(event.target.value));
              }}
              aria-label={t('player.volume')}
            />
            <span className="video-time">
              {formatDuration(time)} / {formatDuration(duration)}
            </span>
            <span className="spacer" />
            <div className="menu-anchor">
              <button
                type="button"
                className="btn btn-sm on-video"
                aria-label={t('player.speed')}
                aria-expanded={menu === 'speed'}
                onClick={() => setMenu((current) => (current === 'speed' ? null : 'speed'))}
              >
                <Gauge size={16} aria-hidden="true" />
                {speed}×
              </button>
              {menu === 'speed' && (
                <div className="video-menu" role="menu">
                  {SPEEDS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={value === speed}
                      onClick={() => {
                        setSpeed(value);
                        setMenu(null);
                      }}
                    >
                      {value}×
                    </button>
                  ))}
                </div>
              )}
            </div>
            {subtitles.length > 0 && (
              <div className="menu-anchor">
                <button
                  type="button"
                  className={`icon-btn on-video${subtitle ? ' is-on' : ''}`}
                  aria-label={t('player.subtitles')}
                  aria-expanded={menu === 'subtitles'}
                  onClick={() => setMenu((current) => (current === 'subtitles' ? null : 'subtitles'))}
                >
                  <Captions size={18} aria-hidden="true" />
                </button>
                {menu === 'subtitles' && (
                  <div className="video-menu" role="menu">
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={subtitle === null}
                      onClick={() => {
                        setSubtitle(null);
                        setMenu(null);
                      }}
                    >
                      {t('player.subtitlesOff')}
                    </button>
                    {subtitles.map((track) => (
                      <button
                        key={track.lang}
                        type="button"
                        role="menuitemradio"
                        aria-checked={subtitle === track.lang}
                        onClick={() => {
                          setSubtitle(track.lang);
                          setMenu(null);
                        }}
                      >
                        {languageLabel(track.lang, language)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {document.pictureInPictureEnabled && (
              <button type="button" className="icon-btn on-video" aria-label={t('player.pip')} onClick={togglePip}>
                <PictureInPicture2 size={18} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="icon-btn on-video"
              aria-label={fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
              onClick={toggleFullscreen}
            >
              {fullscreen ? <Minimize size={18} aria-hidden="true" /> : <Maximize size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
