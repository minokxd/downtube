import { Cpu, Download, Film, LoaderCircle } from 'lucide-react';
import type { EngineComponentId, EngineInstallProgress } from '@shared/types';
import { useLocale, useT, type MessageKey } from '../i18n';
import { PHASE_LABEL } from '../i18n/labels';
import { formatBytes } from '../lib/format';
import { useEngine } from '../stores/engine';
import { useLibrary } from '../stores/library';
import { useUi } from '../stores/ui';
import './setup.css';

const COMPONENTS: ReadonlyArray<{ id: EngineComponentId; icon: typeof Download; name: string; description: MessageKey }> = [
  { id: 'ytdlp', icon: Download, name: 'yt-dlp', description: 'setup.desc.ytdlp' },
  { id: 'deno', icon: Cpu, name: 'Deno', description: 'setup.desc.deno' },
  { id: 'ffmpeg', icon: Film, name: 'ffmpeg', description: 'setup.desc.ffmpeg' },
];

function downloadPercent(progress: EngineInstallProgress | undefined): number | null {
  if (!progress || progress.phase !== 'download' || !progress.totalBytes) return null;
  return Math.min(100, (progress.receivedBytes / progress.totalBytes) * 100);
}

export function SetupPage() {
  const t = useT();
  const locale = useLocale();
  const status = useEngine((s) => s.status);
  const installing = useEngine((s) => s.installing);
  const installError = useEngine((s) => s.installError);
  const progress = useEngine((s) => s.progress);
  const install = useEngine((s) => s.install);
  const hasLibrary = useLibrary((s) => s.items.length > 0);
  const setSkipSetup = useUi((s) => s.setSkipSetup);

  return (
    <div className="setup">
      <div className="setup-card">
        <h1 className="page-title">{t('setup.title')}</h1>
        <p className="setup-lead">{t('setup.body')}</p>
        <ul className="setup-list">
          {COMPONENTS.map(({ id, icon: Icon, name, description }) => {
            const component = status?.components.find((c) => c.id === id);
            const current = progress[id];
            const ready = Boolean(component?.installed && component.version) || current?.phase === 'done';
            const failed = current?.phase === 'error';
            const busy = installing && !ready && !failed && current !== undefined;
            const percent = downloadPercent(current);
            let state = '';
            if (failed) state = t('setup.phase.error');
            else if (ready) state = component?.source === 'system' ? t('setup.systemFfmpeg') : t('setup.phase.done');
            else if (current) state = t(PHASE_LABEL[current.phase]);
            else if (installing) state = t('setup.phase.waiting');
            return (
              <li key={id} className="setup-item">
                <span className="setup-item-icon">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <div>
                  <div className="setup-item-name">{name}</div>
                  <div className="setup-item-desc">{t(description)}</div>
                  {busy && (
                    <div className={`progress${percent === null ? ' is-indeterminate' : ''}`}>
                      <span style={{ width: `${percent ?? 0}%` }} />
                    </div>
                  )}
                  {busy && current?.phase === 'download' && current.totalBytes ? (
                    <div className="setup-item-bytes">
                      {formatBytes(current.receivedBytes, locale)} / {formatBytes(current.totalBytes, locale)}
                    </div>
                  ) : null}
                </div>
                <span className={`setup-item-state${ready ? ' is-done' : ''}${failed ? ' is-error' : ''}`}>
                  {busy && <LoaderCircle size={14} className="spin" aria-hidden="true" />}
                  {state}
                </span>
              </li>
            );
          })}
        </ul>
        {installError && (
          <p className="setup-error" role="alert">
            {t('setup.failed')}
          </p>
        )}
        <div className="setup-actions">
          <button type="button" className="btn btn-primary" disabled={installing} onClick={() => void install()}>
            {installing ? t('setup.installing') : installError ? t('common.retry') : t('setup.start')}
          </button>
          {hasLibrary && !installing && (
            <button type="button" className="btn btn-ghost" onClick={() => setSkipSetup(true)}>
              {t('setup.skip')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
