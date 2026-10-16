import { CircleAlert, LoaderCircle, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { availableQualities, pickDefaultQuality } from '@shared/quality';
import {
  QUALITIES,
  type ErrorCode,
  type MediaKind,
  type NewJobInput,
  type ProbeEntry,
  type ProbeList,
  type ProbeVideo,
  type Quality,
  type SpotifyList,
  type SpotifyTrack,
} from '@shared/types';
import { useLocale, useT } from '../i18n';
import { ERROR_LABEL, QUALITY_LABEL } from '../i18n/labels';
import { formatBytes, formatDuration } from '../lib/format';
import { useLibrary } from '../stores/library';
import { useSettings } from '../stores/settings';
import { useUi } from '../stores/ui';
import {
  inLibraryIds,
  listJobs,
  listSize,
  listSubmitIds,
  mergeEntries,
  mergeTracks,
  ownedSpotifyIds,
  playlistUrl,
  spotifyJobs,
  videoJob,
  videoSize,
} from './add-dialog-logic';
import { Segmented, Switch } from './controls';
import { Thumb } from './Thumb';
import './add-dialog.css';

type DialogState =
  | { phase: 'loading' }
  | { phase: 'error'; code: ErrorCode; log?: string }
  | { phase: 'video'; video: ProbeVideo }
  | { phase: 'list'; list: ProbeList; entries: ProbeEntry[]; loadingMore: boolean }
  | { phase: 'spotify'; list: SpotifyList; tracks: SpotifyTrack[]; loadingMore: boolean };

export function AddDialog() {
  const url = useUi((s) => s.addUrl);
  if (!url) return null;
  return <AddDialogContent key={url} url={url} />;
}

function AddDialogContent({ url }: { url: string }) {
  const t = useT();
  const locale = useLocale();
  const close = useUi((s) => s.closeAdd);
  const pushToast = useUi((s) => s.pushToast);
  const setPage = useUi((s) => s.setPage);
  const settings = useSettings((s) => s.settings);
  const items = useLibrary((s) => s.items);
  const [target, setTarget] = useState(url);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DialogState>({ phase: 'loading' });
  const [kind, setKind] = useState<MediaKind>('video');
  const [quality, setQuality] = useState<Quality>(settings?.defaultQuality ?? '1080');
  const [subtitles, setSubtitles] = useState(settings?.subtitles.enabled ?? false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [free, setFree] = useState<number | null>(null);
  const owned = useMemo(() => inLibraryIds(items, kind), [items, kind]);
  const ownedSongs = useMemo(() => ownedSpotifyIds(items), [items]);

  useEffect(() => {
    let cancelled = false;
    window.downtube.app.freeSpace().then(
      (bytes) => {
        if (!cancelled) setFree(bytes);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState({ phase: 'loading' });
    window.downtube.probe(target).then(
      (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setState({ phase: 'error', code: response.code, log: response.log });
          return;
        }
        const { result } = response;
        if (result.type === 'video') {
          setQuality(pickDefaultQuality(availableQualities(result.video.heights), settings?.defaultQuality ?? '1080'));
          if (!result.video.hasSubtitles && !settings?.subtitles.includeAuto) setSubtitles(false);
          setState({ phase: 'video', video: result.video });
        } else if (result.type === 'spotify') {
          setSelected(new Set(result.list.tracks.map((track) => track.id)));
          setState({ phase: 'spotify', list: result.list, tracks: result.list.tracks, loadingMore: false });
        } else {
          setSelected(new Set(result.list.entries.map((e) => e.videoId)));
          setState({ phase: 'list', list: result.list, entries: result.list.entries, loadingMore: false });
        }
      },
      () => {
        if (!cancelled) setState({ phase: 'error', code: 'UNKNOWN' });
      },
    );
    return () => {
      cancelled = true;
    };
    // settings are read once when the probe starts
  }, [target, attempt]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const entries = state.phase === 'list' ? state.entries : [];
  const selectable = entries.filter((entry) => !owned.has(entry.videoId));
  const chosen = selectable.filter((entry) => selected.has(entry.videoId));
  const songs = state.phase === 'spotify' ? state.tracks : [];
  const selectableSongs = songs.filter((track) => !ownedSongs.has(track.id));
  const chosenSongs = selectableSongs.filter((track) => selected.has(track.id));
  const selectableIds = state.phase === 'spotify' ? selectableSongs.map((track) => track.id) : selectable.map((entry) => entry.videoId);
  const chosenCount = state.phase === 'spotify' ? chosenSongs.length : chosen.length;
  const allChosen = selectableIds.length > 0 && chosenCount === selectableIds.length;
  const qualityOptions = state.phase === 'video' ? availableQualities(state.video.heights) : QUALITIES;
  const canSubmit =
    !submitting &&
    (state.phase === 'video'
      ? !owned.has(state.video.videoId)
      : state.phase === 'list'
        ? chosen.length > 0
        : state.phase === 'spotify' && chosenSongs.length > 0);
  const size =
    state.phase === 'video'
      ? videoSize(state.video, kind, quality)
      : state.phase === 'list'
        ? listSize(chosen, kind, quality)
        : state.phase === 'spotify'
          ? listSize(chosenSongs, 'audio', quality)
          : undefined;
  const lowSpace = size !== undefined && free !== null && size.bytes > free;

  const toggle = (videoId: string): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  };

  const toggleAll = (): void => {
    setSelected(allChosen ? new Set() : new Set(selectableIds));
  };

  const loadMoreSongs = async (current: Extract<DialogState, { phase: 'spotify' }>): Promise<void> => {
    setState({ ...current, loadingMore: true });
    const response = await window.downtube.probe(current.list.sourceUrl, current.list.nextStart).catch(() => null);
    if (!response || !response.ok || response.result.type !== 'spotify') {
      pushToast({ message: t(ERROR_LABEL[response && !response.ok ? response.code : 'UNKNOWN']), tone: 'error' });
      setState({ ...current, loadingMore: false });
      return;
    }
    const next = response.result.list;
    setSelected((sel) => new Set([...sel, ...next.tracks.map((track) => track.id)]));
    setState({
      phase: 'spotify',
      list: { ...current.list, hasMore: next.hasMore, nextStart: next.nextStart, totalCount: next.totalCount ?? current.list.totalCount },
      tracks: mergeTracks(current.tracks, next.tracks),
      loadingMore: false,
    });
  };

  const loadMore = async (): Promise<void> => {
    if (state.phase === 'spotify' && !state.loadingMore) return loadMoreSongs(state);
    if (state.phase !== 'list' || state.loadingMore) return;
    const current = state;
    setState({ ...current, loadingMore: true });
    const response = await window.downtube.probe(current.list.sourceUrl, current.list.nextStart).catch(() => null);
    if (!response || !response.ok || response.result.type !== 'list') {
      pushToast({ message: t(ERROR_LABEL[response && !response.ok ? response.code : 'UNKNOWN']), tone: 'error' });
      setState({ ...current, loadingMore: false });
      return;
    }
    const next = response.result.list;
    setSelected((sel) => new Set([...sel, ...next.entries.map((e) => e.videoId)]));
    setState({
      phase: 'list',
      list: { ...current.list, hasMore: next.hasMore, nextStart: next.nextStart, totalCount: next.totalCount ?? current.list.totalCount },
      entries: mergeEntries(current.entries, next.entries),
      loadingMore: false,
    });
  };

  const submit = async (): Promise<void> => {
    const choice = { kind, quality, subtitles };
    let inputs: NewJobInput[] = [];
    if (state.phase === 'video') inputs = [videoJob(state.video, choice)];
    else if (state.phase === 'list') inputs = listJobs(state.list, state.entries, listSubmitIds(state.entries, chosen, owned), choice);
    else if (state.phase === 'spotify') {
      // Owned songs go along so they join the new album or playlist, as listSubmitIds does for YouTube.
      const ids = new Set([...chosenSongs, ...state.tracks.filter((track) => ownedSongs.has(track.id))].map((track) => track.id));
      inputs = spotifyJobs(state.list, state.tracks, ids, quality);
    }
    if (inputs.length === 0) return;
    setSubmitting(true);
    try {
      const result = await window.downtube.jobs.add(inputs);
      if (result.added > 0) {
        pushToast({
          message: t('add.queued', { count: result.added }),
          tone: 'success',
          action: { label: t('add.viewDownloads'), run: () => setPage('downloads') },
        });
      }
      if (result.skipped.length > 0) pushToast({ message: t('add.skipped', { count: result.skipped.length }) });
      close();
    } catch {
      pushToast({ message: t('error.UNKNOWN'), tone: 'error' });
      setSubmitting(false);
    }
  };

  const options = (
    <div className="add-options">
      <div className="add-option">
        <span className="add-option-label">{t('add.type')}</span>
        <Segmented
          label={t('add.type')}
          value={kind}
          onChange={setKind}
          options={[
            { value: 'video', label: t('kind.video') },
            { value: 'audio', label: t('kind.audio') },
          ]}
        />
      </div>
      {kind === 'video' && (
        <div className="add-option">
          <span className="add-option-label">{t('add.quality')}</span>
          <Segmented
            label={t('add.quality')}
            value={quality}
            onChange={setQuality}
            options={qualityOptions.map((q) => ({ value: q, label: t(QUALITY_LABEL[q]) }))}
          />
        </div>
      )}
      {kind === 'video' && (
        <div className="add-option">
          <span className="add-option-label">{t('add.subtitles')}</span>
          <Switch label={t('add.subtitles')} checked={subtitles} onChange={setSubtitles} />
        </div>
      )}
      {kind === 'video' && state.phase === 'video' && !state.video.hasSubtitles && <p className="add-note">{t('add.noSubtitles')}</p>}
    </div>
  );

  const loadMoreButton = (loadingMore: boolean) => (
    <div className="add-load-more">
      <button type="button" className="btn btn-sm" disabled={loadingMore} onClick={() => void loadMore()}>
        {loadingMore && <LoaderCircle size={14} className="spin" aria-hidden="true" />}
        {t('add.loadMore')}
      </button>
    </div>
  );

  const listHead = (
    <div className="add-list-head">
      <span className="add-option-label">{t('add.selected', { count: chosenCount })}</span>
      <button type="button" className="btn btn-ghost btn-sm" disabled={selectableIds.length === 0} onClick={toggleAll}>
        {allChosen ? t('add.selectNone') : t('add.selectAll')}
      </button>
    </div>
  );

  let body: ReactNode = null;
  if (state.phase === 'loading') {
    body = (
      <>
        <div className="add-skeleton" aria-hidden="true">
          <div className="skeleton thumb" />
          <div>
            <div className="skeleton line" />
            <div className="skeleton line short" />
          </div>
        </div>
        <p className="add-probing">
          <LoaderCircle size={14} className="spin" aria-hidden="true" />
          {t('add.probing')}
        </p>
      </>
    );
  } else if (state.phase === 'error') {
    body = (
      <div className="add-error" role="alert">
        <CircleAlert size={18} className="add-error-icon" aria-hidden="true" />
        <div>
          <p className="add-error-text">{t(ERROR_LABEL[state.code])}</p>
          {state.log && (
            <button type="button" className="link-btn" onClick={() => setShowLog((v) => !v)}>
              {showLog ? t('error.hideDetails') : t('error.showDetails')}
            </button>
          )}
          {showLog && state.log && <pre className="add-log">{state.log}</pre>}
        </div>
      </div>
    );
  } else if (state.phase === 'video') {
    const { video } = state;
    const listId = video.listId;
    body = (
      <>
        <div className="add-media">
          <Thumb src={video.thumbnailUrl} className="add-thumb" />
          <div>
            <p className="add-media-title">{video.title}</p>
            <p className="add-media-meta">
              {video.channel}
              {video.durationSec !== undefined && ` · ${formatDuration(video.durationSec)}`}
            </p>
            {listId && (
              <button type="button" className="link-btn" onClick={() => setTarget(playlistUrl(listId))}>
                {t('add.showPlaylist')}
              </button>
            )}
          </div>
        </div>
        {options}
        {owned.has(video.videoId) && <p className="add-warning">{t('add.alreadyInLibrary')}</p>}
      </>
    );
  } else if (state.phase === 'spotify') {
    const { list, tracks } = state;
    const note = <p className="add-note">{t('add.spotifyNote')}</p>;
    const single = list.kind === 'track' ? tracks[0] : undefined;
    if (single) {
      body = (
        <>
          <div className="add-media is-song">
            <Thumb src={single.coverUrl ?? list.coverUrl} className="add-thumb" kind="audio" />
            <div>
              <p className="add-media-title">{single.title}</p>
              <p className="add-media-meta">
                {single.artist}
                {single.durationSec !== undefined && ` · ${formatDuration(single.durationSec)}`}
              </p>
              {note}
            </div>
          </div>
          {ownedSongs.has(single.id) && <p className="add-warning">{t('add.alreadyInLibrary')}</p>}
        </>
      );
    } else {
      body = (
        <>
          <div className="add-media is-song">
            <Thumb src={list.coverUrl} className="add-thumb" kind="audio" />
            <div>
              <p className="add-media-title">{list.title}</p>
              <p className="add-media-meta">
                <span className="badge">{list.kind === 'album' ? t('add.album') : t('add.playlist')}</span>
                {list.owner}
              </p>
              <p className="add-media-meta">
                {list.totalCount && list.totalCount > tracks.length
                  ? t('add.songCountOf', { count: tracks.length, total: list.totalCount })
                  : t('add.songCount', { count: tracks.length })}
              </p>
              {note}
            </div>
          </div>
          {list.partial && <p className="add-warning">{t('add.spotifyPartial', { count: tracks.length })}</p>}
          {tracks.length === 0 ? (
            <p className="add-note" style={{ marginTop: 16 }}>
              {t('add.noSongs')}
            </p>
          ) : (
            <>
              {listHead}
              <ul className="add-list">
                {tracks.map((track, index) => {
                  const isOwned = ownedSongs.has(track.id);
                  return (
                    <li key={track.id}>
                      <label className={`add-entry is-song${isOwned ? ' is-owned' : ''}`}>
                        <input
                          type="checkbox"
                          className="check"
                          checked={!isOwned && selected.has(track.id)}
                          disabled={isOwned}
                          onChange={() => toggle(track.id)}
                        />
                        {list.kind === 'album' ? (
                          <span className="add-entry-number">{track.trackNumber ?? index + 1}</span>
                        ) : (
                          <Thumb src={track.coverUrl} className="add-entry-thumb" kind="audio" />
                        )}
                        <span className="add-entry-text">
                          <span className="add-entry-title" title={track.title}>
                            {track.title}
                          </span>
                          <span className="add-entry-sub">{track.artist}</span>
                        </span>
                        <span className="add-entry-meta">
                          {isOwned ? <span className="badge badge-accent">{t('add.inLibrary')}</span> : formatDuration(track.durationSec)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {list.hasMore && loadMoreButton(state.loadingMore)}
            </>
          )}
        </>
      );
    }
  } else {
    const { list } = state;
    body = (
      <>
        <p className="add-media-title">{list.title}</p>
        <p className="add-media-meta">
          <span className="badge">{list.listKind === 'channel' ? t('add.channel') : t('add.playlist')}</span>
          {list.totalCount
            ? t('add.videoCountOf', { count: state.entries.length, total: list.totalCount })
            : t('add.videoCount', { count: state.entries.length })}
        </p>
        {options}
        {state.entries.length === 0 ? (
          <p className="add-note" style={{ marginTop: 16 }}>
            {t('add.emptyList')}
          </p>
        ) : (
          <>
            {listHead}
            <ul className="add-list">
              {state.entries.map((entry) => {
                const isOwned = owned.has(entry.videoId);
                return (
                  <li key={entry.videoId}>
                    <label className={`add-entry${isOwned ? ' is-owned' : ''}`}>
                      <input
                        type="checkbox"
                        className="check"
                        checked={!isOwned && selected.has(entry.videoId)}
                        disabled={isOwned}
                        onChange={() => toggle(entry.videoId)}
                      />
                      <Thumb src={entry.thumbnailUrl} className="add-entry-thumb" />
                      <span className="add-entry-title" title={entry.title}>
                        {entry.title}
                      </span>
                      <span className="add-entry-meta">
                        {isOwned ? <span className="badge badge-accent">{t('add.inLibrary')}</span> : formatDuration(entry.durationSec)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {list.hasMore && loadMoreButton(state.loadingMore)}
          </>
        )}
      </>
    );
  }

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="dialog add-dialog" role="dialog" aria-modal="true" aria-labelledby="add-title">
        <div className="dialog-header">
          <h2 id="add-title" className="dialog-title">
            {t('add.title')}
          </h2>
          <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={close}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="dialog-body">{body}</div>
        <div className="dialog-footer">
          {size && (
            <div className="add-size">
              <span className="add-size-total">
                {t(size.atLeast ? 'add.sizeAtLeast' : size.estimated ? 'add.sizeEstimate' : 'add.size', {
                  size: formatBytes(size.bytes, locale),
                })}
              </span>
              {free !== null && <span>{t('add.freeSpace', { size: formatBytes(free, locale) })}</span>}
              {lowSpace && <span className="add-size-warning">{t('add.lowSpace')}</span>}
            </div>
          )}
          <button type="button" className="btn btn-ghost" onClick={close}>
            {t('common.cancel')}
          </button>
          {state.phase === 'error' ? (
            <button type="button" className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
              {t('common.retry')}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={!canSubmit} onClick={() => void submit()}>
              {state.phase === 'list'
                ? t('add.downloadSelected', { count: chosen.length })
                : state.phase === 'spotify' && state.list.kind !== 'track'
                  ? t('add.downloadSongs', { count: chosenSongs.length })
                  : t('add.download')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
