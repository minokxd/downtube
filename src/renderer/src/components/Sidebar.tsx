import { Download, Library, Settings } from 'lucide-react';
import { useMemo } from 'react';
import { useT, type MessageKey } from '../i18n';
import { isActiveJob, useJobs } from '../stores/jobs';
import { useUi, type Page } from '../stores/ui';
import { PlaylistNav } from './PlaylistNav';

const NAV: ReadonlyArray<{ page: Page; icon: typeof Library; label: MessageKey }> = [
  { page: 'library', icon: Library, label: 'nav.library' },
  { page: 'downloads', icon: Download, label: 'nav.downloads' },
  { page: 'settings', icon: Settings, label: 'nav.settings' },
];

export function Sidebar() {
  const t = useT();
  const page = useUi((s) => s.page);
  const view = useUi((s) => s.libraryView);
  const setPage = useUi((s) => s.setPage);
  const jobs = useJobs((s) => s.jobs);
  const active = useMemo(() => jobs.filter(isActiveJob).length, [jobs]);

  return (
    <nav className="sidebar" aria-label="Downtube">
      {NAV.map(({ page: target, icon: Icon, label }) => {
        // While one of the user's playlists is open, its row is the current entry instead of Library.
        const current = page === target && !(target === 'library' && view?.type === 'playlist');
        return (
          <button
            key={target}
            type="button"
            className={`nav-item${current ? ' is-active' : ''}`}
            aria-current={current ? 'page' : undefined}
            onClick={() => setPage(target)}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{t(label)}</span>
            {target === 'downloads' && active > 0 && <span className="nav-badge">{active}</span>}
          </button>
        );
      })}
      <PlaylistNav />
    </nav>
  );
}
