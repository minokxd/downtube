import { useEffect } from 'react';
import { AddDialog } from './components/AddDialog';
import { Sidebar } from './components/Sidebar';
import { TitleBar } from './components/TitleBar';
import { Toasts } from './components/Toasts';
import { translate } from './i18n';
import { useAppliedTheme } from './lib/use-applied-theme';
import { DownloadsPage } from './pages/DownloadsPage';
import { LibraryPage } from './pages/LibraryPage';
import { SettingsPage } from './pages/SettingsPage';
import { SetupPage } from './pages/SetupPage';
import { MusicBar } from './player/MusicBar';
import { VideoPlayer } from './player/VideoPlayer';
import { useEngine } from './stores/engine';
import { useJobs } from './stores/jobs';
import { useLibrary } from './stores/library';
import { useSettings } from './stores/settings';
import { useUi } from './stores/ui';

const language = () => useSettings.getState().settings?.language ?? 'tr';

function showClipboardToast(url: string): void {
  useUi.getState().pushToast({
    message: translate(language(), 'clipboard.found'),
    action: { label: translate(language(), 'clipboard.download'), run: () => useUi.getState().openAdd(url) },
    durationMs: 10_000,
  });
}

export function App() {
  const settings = useSettings((s) => s.settings);
  const engineStatus = useEngine((s) => s.status);
  const page = useUi((s) => s.page);
  const skipSetup = useUi((s) => s.skipSetup);
  useAppliedTheme(settings?.theme);

  useEffect(() => {
    const api = window.downtube;
    void useSettings.getState().load();
    void useLibrary.getState().load();
    void useJobs.getState().load();
    void useEngine.getState().refresh();
    void api.app.info().then((info) => {
      if (info.libraryRecovered === 'none') return;
      const key = info.libraryRecovered === 'backup' ? 'library.recoveredBackup' : 'library.recoveredReset';
      useUi.getState().pushToast({ message: translate(language(), key), tone: 'error', durationMs: 12_000 });
    });
    const unsubscribers = [
      api.settings.onChanged((next) => useSettings.getState().apply(next)),
      api.library.onChanged((snapshot) => useLibrary.getState().apply(snapshot)),
      api.jobs.onChanged((jobs) => useJobs.getState().apply(jobs)),
      api.engine.onProgress((progress) => useEngine.getState().onProgress(progress)),
      api.clipboard.onYoutubeLink(showClipboardToast),
    ];
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (settings) document.documentElement.lang = settings.language;
  }, [settings]);

  if (!settings || !engineStatus) return <div className="boot" aria-busy="true" />;
  const showSetup = !engineStatus.ready && !skipSetup;

  return (
    <div className="app">
      <TitleBar showLinkBar={!showSetup} />
      {showSetup ? (
        <SetupPage />
      ) : (
        <div className="shell">
          <Sidebar />
          <main className="content">
            {page === 'library' && <LibraryPage />}
            {page === 'downloads' && <DownloadsPage />}
            {page === 'settings' && <SettingsPage />}
          </main>
        </div>
      )}
      <MusicBar />
      <AddDialog />
      <VideoPlayer />
      <Toasts />
    </div>
  );
}
