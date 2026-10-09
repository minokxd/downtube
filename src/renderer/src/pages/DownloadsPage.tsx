import { Download, Play, RotateCcw, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Job } from '@shared/types';
import { Thumb } from '../components/Thumb';
import { useLocale, useT } from '../i18n';
import { ERROR_LABEL, QUALITY_LABEL, STAGE_LABEL, STATUS_LABEL } from '../i18n/labels';
import { formatBytes, formatDuration, formatPercent, formatSpeed } from '../lib/format';
import { useJobs } from '../stores/jobs';
import { usePlayer } from '../stores/player';
import { useUi } from '../stores/ui';
import { sortJobs } from './downloads-logic';
import './downloads.css';

function JobRow({ job }: { job: Job }) {
  const t = useT();
  const locale = useLocale();
  const openVideo = useUi((s) => s.openVideo);
  const [showLog, setShowLog] = useState(false);
  const active = job.status === 'downloading' || job.status === 'processing';
  const pending = active || job.status === 'queued' || job.status === 'paused';
  const finished = job.status === 'done' || job.status === 'failed' || job.status === 'canceled';
  const status = active ? t(STAGE_LABEL[job.progress.stage]) : t(STATUS_LABEL[job.status]);

  const details: string[] = [];
  if (job.status === 'downloading') {
    if (job.progress.totalBytes) {
      details.push(`${formatBytes(job.progress.downloadedBytes, locale)} / ${formatBytes(job.progress.totalBytes, locale)}`);
    }
    if (job.progress.speedBps) details.push(formatSpeed(job.progress.speedBps, locale));
    if (job.progress.etaSec !== undefined) details.push(t('downloads.eta', { time: formatDuration(job.progress.etaSec) }));
  }

  const play = (): void => {
    if (!job.libraryItemId) return;
    if (job.kind === 'video') openVideo(job.libraryItemId);
    else usePlayer.getState().playItems([job.libraryItemId]);
  };

  return (
    <li className={`job job-${job.status}`}>
      <Thumb src={job.thumbnailUrl} className="job-thumb" kind={job.kind} />
      <div className="job-main">
        <div className="job-title" title={job.title}>
          {job.title}
        </div>
        <div className="job-meta">
          <span className="badge">{job.kind === 'video' ? `${t('common.video')} · ${t(QUALITY_LABEL[job.quality])}` : 'MP3'}</span>
          <span className={`job-status status-${job.status}`}>{status}</span>
          {details.map((detail) => (
            <span key={detail} className="job-detail">
              {detail}
            </span>
          ))}
        </div>
        {pending && (
          <div className={`progress${job.status === 'processing' ? ' is-indeterminate' : ''}`}>
            <span style={{ width: `${job.progress.percent}%` }} />
          </div>
        )}
        {job.status === 'failed' && job.error && (
          <div className="job-error">
            <span>{t(ERROR_LABEL[job.error.code])}</span>
            {job.error.log && (
              <button type="button" className="link-btn" onClick={() => setShowLog((value) => !value)}>
                {showLog ? t('error.hideDetails') : t('error.showDetails')}
              </button>
            )}
          </div>
        )}
        {showLog && job.error?.log && <pre className="job-log">{job.error.log}</pre>}
      </div>
      <div className="job-percent">{pending ? formatPercent(job.progress.percent, locale) : ''}</div>
      <div className="job-actions">
        {job.status === 'paused' && (
          <button type="button" className="btn btn-sm" onClick={() => void window.downtube.jobs.retry(job.id)}>
            {t('downloads.resume')}
          </button>
        )}
        {(job.status === 'failed' || job.status === 'canceled') && (
          <button type="button" className="btn btn-sm" onClick={() => void window.downtube.jobs.retry(job.id)}>
            <RotateCcw size={14} aria-hidden="true" />
            {t('common.retry')}
          </button>
        )}
        {job.status === 'done' && job.libraryItemId && (
          <button type="button" className="btn btn-sm" onClick={play}>
            <Play size={14} aria-hidden="true" />
            {t('downloads.play')}
          </button>
        )}
        {pending && (
          <button
            type="button"
            className="icon-btn"
            aria-label={t('downloads.cancel')}
            title={t('downloads.cancel')}
            onClick={() => void window.downtube.jobs.cancel(job.id)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
        {finished && (
          <button
            type="button"
            className="icon-btn"
            aria-label={t('downloads.remove')}
            title={t('downloads.remove')}
            onClick={() => void window.downtube.jobs.remove(job.id)}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}

export function DownloadsPage() {
  const t = useT();
  const jobs = useJobs((s) => s.jobs);
  const sorted = useMemo(() => sortJobs(jobs), [jobs]);
  const hasFinished = jobs.some((job) => job.status === 'done' || job.status === 'canceled');

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('downloads.title')}</h1>
        {hasFinished && (
          <button type="button" className="btn btn-sm" onClick={() => void window.downtube.jobs.clearFinished()}>
            {t('downloads.clearFinished')}
          </button>
        )}
      </div>
      {sorted.length === 0 ? (
        <div className="empty">
          <div>
            <div className="empty-icon">
              <Download size={24} aria-hidden="true" />
            </div>
            <h2>{t('downloads.empty.title')}</h2>
            <p>{t('downloads.empty.body')}</p>
          </div>
        </div>
      ) : (
        <ul className="job-list">
          {sorted.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </ul>
      )}
    </div>
  );
}
