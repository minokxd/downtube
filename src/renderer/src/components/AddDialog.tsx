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
} from '@shared/types';
import { useT } from '../i18n';
import { ERROR_LABEL, QUALITY_LABEL } from '../i18n/labels';
import { formatDuration } from '../lib/format';
import { useLibrary } from '../stores/library';
import { useSettings } from '../stores/settings';
import { useUi } from '../stores/ui';
import { inLibraryIds, listJobs, mergeEntries, playlistUrl, videoJob } from './add-dialog-logic';
import { Segmented, Switch } from './controls';
import { Thumb } from './Thumb';
import './add-dialog.css';

type DialogState =
  | { phase: 'loading' }
  | { phase: 'error'; code: ErrorCode; log?: string }
  | { phase: 'video'; video: ProbeVideo }
  | { phase: 'list'; list: ProbeList; entries: ProbeEntry[]; loadingMore: boolean };

export function AddDialog() {
  const url = useUi((s) => s.addUrl);
  if (!url) return null;
  return <AddDialogContent key={url} url={url} />;
}

function AddDialogContent({ url }: { url: string }) {
  const t = useT();
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
  const owned = useMemo(() => inLibraryIds(items, kind), [items, kind]);

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
  const allChosen = selectable.length > 0 && chosen.length === selectable.length;
  const qualityOptions = state.phase === 'video' ? availableQualities(state.video.heights) : QUALITIES;
  const canSubmit =
    !submitting && (state.phase === 'video' ? !owned.has(state.video.videoId) : state.phase === 'list' && chosen.length > 0);

  const toggle = (videoId: string): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  };

  const toggleAll = (): void => {
    setSelected(allChosen ? new Set() : new Set(selectable.map((entry) => entry.videoId)));
  };

  const loadMore = async (): Promise<void> => {
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
    else if (state.phase === 'list') inputs = listJobs(state.list, state.entries, new Set(chosen.map((e) => e.videoId)), choice);
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
            <div className="add-list-head">
              <span className="add-option-label">{t('add.selected', { count: chosen.length })}</span>
              <button type="button" className="btn btn-ghost btn-sm" disabled={selectable.length === 0} onClick={toggleAll}>
                {allChosen ? t('add.selectNone') : t('add.selectAll')}
              </button>
            </div>
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
            {list.hasMore && (
              <div className="add-load-more">
                <button type="button" className="btn btn-sm" disabled={state.loadingMore} onClick={() => void loadMore()}>
                  {state.loadingMore && <LoaderCircle size={14} className="spin" aria-hidden="true" />}
                  {t('add.loadMore')}
                </button>
              </div>
            )}
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
          <button type="button" className="btn btn-ghost" onClick={close}>
            {t('common.cancel')}
          </button>
          {state.phase === 'error' ? (
            <button type="button" className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
              {t('common.retry')}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={!canSubmit} onClick={() => void submit()}>
              {state.phase === 'list' ? t('add.downloadSelected', { count: chosen.length }) : t('add.download')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
