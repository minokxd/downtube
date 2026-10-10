import { Check, CircleAlert, FolderOpen, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SettingsPatch } from '@shared/ipc-contract';
import { LANGUAGES } from '@shared/languages';
import { QUALITIES, type EngineComponentId, type Language } from '@shared/types';
import { Segmented, Switch } from '../components/controls';
import { useLocale, useT } from '../i18n';
import { QUALITY_LABEL } from '../i18n/labels';
import { parseLangs } from '../lib/langs';
import { useEngine } from '../stores/engine';
import { isActiveJob, useJobs } from '../stores/jobs';
import { useSettings } from '../stores/settings';
import { useUi } from '../stores/ui';
import './settings.css';

const ENGINE_NAMES: Record<EngineComponentId, string> = { ytdlp: 'yt-dlp', deno: 'Deno', ffmpeg: 'ffmpeg' };

function Row({ label, hint, children }: { label: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-row-label">
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </div>
      {children && <div className="settings-row-control">{children}</div>}
    </div>
  );
}

export function SettingsPage() {
  const t = useT();
  const locale = useLocale();
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const pushToast = useUi((s) => s.pushToast);
  const engine = useEngine((s) => s.status);
  const installing = useEngine((s) => s.installing);
  const install = useEngine((s) => s.install);
  const refreshEngine = useEngine((s) => s.refresh);
  const jobs = useJobs((s) => s.jobs);
  const busy = useMemo(() => jobs.some(isActiveJob), [jobs]);
  const [version, setVersion] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const savedLangs = settings?.subtitles.langs.join(', ') ?? '';
  const [langsText, setLangsText] = useState(savedLangs);

  useEffect(() => {
    void window.downtube.app.info().then((info) => setVersion(info.version));
  }, []);

  useEffect(() => setLangsText(savedLangs), [savedLangs]);

  if (!settings) return null;

  const save = (patch: SettingsPatch): void => {
    void update(patch).catch(() => pushToast({ message: t('settings.saveFailed'), tone: 'error' }));
  };

  const saveLangs = (): void => {
    const langs = parseLangs(langsText);
    if (langs.join(',') !== settings.subtitles.langs.join(',')) save({ subtitles: { ...settings.subtitles, langs } });
  };

  const chooseFolder = (): void => {
    void window.downtube.settings.chooseDownloadDir().catch(() => pushToast({ message: t('settings.saveFailed'), tone: 'error' }));
  };

  const runUpdate = async (): Promise<void> => {
    setUpdating(true);
    setUpdateMessage(null);
    try {
      const result = await window.downtube.engine.update();
      if (result.ok) setUpdateMessage(t('settings.engine.updated', { version: result.version ?? '?' }));
      else setUpdateMessage(result.message === 'busy' ? t('settings.engine.busy') : t('settings.engine.updateFailed'));
      await refreshEngine();
    } catch {
      setUpdateMessage(t('settings.engine.updateFailed'));
    } finally {
      setUpdating(false);
    }
  };

  const reinstall = async (): Promise<void> => {
    try {
      await install(true);
    } catch {
      // the store has already recorded the failure in installError; only its follow-up status refresh failed
    }
    const err = useEngine.getState().installError;
    if (err) pushToast({ message: err.includes('busy') ? t('settings.engine.busy') : t('setup.failed'), tone: 'error' });
  };

  const lastCheck = settings.lastYtdlpUpdateCheck
    ? t('settings.engine.lastCheck', {
        date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(settings.lastYtdlpUpdateCheck)),
      })
    : t('settings.engine.neverChecked');

  return (
    <div className="page settings">
      <div className="page-header">
        <h1 className="page-title">{t('settings.title')}</h1>
      </div>

      <section className="settings-section">
        <h2>{t('settings.appearance')}</h2>
        <div className="settings-card">
          <Row label={t('settings.theme')}>
            <Segmented
              label={t('settings.theme')}
              value={settings.theme}
              onChange={(theme) => save({ theme })}
              options={[
                { value: 'system', label: t('settings.theme.system') },
                { value: 'dark', label: t('settings.theme.dark') },
                { value: 'light', label: t('settings.theme.light') },
              ]}
            />
          </Row>
          <Row label={t('settings.language')}>
            {/* Each language is listed under its own name, so anyone can find theirs. */}
            <select
              className="select"
              value={settings.language}
              onChange={(event) => save({ language: event.target.value as Language })}
              aria-label={t('settings.language')}
            >
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.name}
                </option>
              ))}
            </select>
          </Row>
        </div>
      </section>

      <section className="settings-section">
        <h2>{t('settings.downloads')}</h2>
        <div className="settings-card">
          <Row label={t('settings.folder')} hint={settings.downloadDir}>
            <button type="button" className="btn btn-sm" onClick={chooseFolder}>
              <FolderOpen size={14} aria-hidden="true" />
              {t('settings.change')}
            </button>
          </Row>
          <Row label={t('settings.defaultQuality')}>
            <Segmented
              label={t('settings.defaultQuality')}
              value={settings.defaultQuality}
              onChange={(defaultQuality) => save({ defaultQuality })}
              options={QUALITIES.map((quality) => ({ value: quality, label: t(QUALITY_LABEL[quality]) }))}
            />
          </Row>
          <Row label={t('settings.concurrency')}>
            <Segmented
              label={t('settings.concurrency')}
              value={settings.concurrency}
              onChange={(concurrency) => save({ concurrency })}
              options={[1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))}
            />
          </Row>
        </div>
      </section>

      <section className="settings-section">
        <h2>{t('settings.subtitles')}</h2>
        <div className="settings-card">
          <Row label={t('settings.subtitlesDefault')}>
            <Switch
              label={t('settings.subtitlesDefault')}
              checked={settings.subtitles.enabled}
              onChange={(enabled) => save({ subtitles: { ...settings.subtitles, enabled } })}
            />
          </Row>
          <Row label={t('settings.subtitleLangs')} hint={t('settings.subtitleLangsHint')}>
            <input
              className="input input-sm"
              value={langsText}
              onChange={(event) => setLangsText(event.target.value)}
              onBlur={saveLangs}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              aria-label={t('settings.subtitleLangs')}
              spellCheck={false}
            />
          </Row>
          <Row label={t('settings.includeAuto')}>
            <Switch
              label={t('settings.includeAuto')}
              checked={settings.subtitles.includeAuto}
              onChange={(includeAuto) => save({ subtitles: { ...settings.subtitles, includeAuto } })}
            />
          </Row>
        </div>
      </section>

      <section className="settings-section">
        <h2>{t('settings.clipboard')}</h2>
        <div className="settings-card">
          <Row label={t('settings.clipboardWatch')}>
            <Switch label={t('settings.clipboardWatch')} checked={settings.clipboardWatch} onChange={(clipboardWatch) => save({ clipboardWatch })} />
          </Row>
        </div>
      </section>

      <section className="settings-section">
        <h2>{t('settings.engine')}</h2>
        <div className="settings-card">
          {engine?.components.map((component) => (
            <Row
              key={component.id}
              label={ENGINE_NAMES[component.id]}
              hint={
                component.installed
                  ? `${component.version ?? '?'} · ${component.source === 'system' ? t('settings.engine.system') : t('settings.engine.bundled')}`
                  : t('settings.engine.missing')
              }
            >
              {component.installed && component.version ? (
                <Check size={16} className="engine-ok" aria-hidden="true" />
              ) : (
                <CircleAlert size={16} className="engine-missing" aria-hidden="true" />
              )}
            </Row>
          ))}
          <Row label={t('settings.engine.updates')} hint={lastCheck}>
            <button type="button" className="btn btn-sm" disabled={updating || installing || busy} onClick={() => void runUpdate()}>
              <RefreshCw size={14} className={updating ? 'spin' : undefined} aria-hidden="true" />
              {updating ? t('settings.engine.updating') : t('settings.engine.update')}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" disabled={updating || installing || busy} onClick={() => void reinstall()}>
              {installing && <RefreshCw size={14} className="spin" aria-hidden="true" />}
              {installing ? t('setup.installing') : t('settings.engine.reinstall')}
            </button>
          </Row>
          {updateMessage && (
            <p className="settings-message" role="status">
              {updateMessage}
            </p>
          )}
        </div>
      </section>

      <section className="settings-section">
        <h2>{t('settings.about')}</h2>
        <div className="settings-card">
          <Row label="Downtube" hint={t('settings.version', { version })} />
        </div>
        <p className="settings-disclaimer">{t('settings.disclaimer')}</p>
      </section>
    </div>
  );
}
