import { Download, Library, Settings } from 'lucide-react';
import { useMemo } from 'react';
import { useT, type MessageKey } from '../i18n';
import { isActiveJob, useJobs } from '../stores/jobs';
import { useUi, type Page } from '../stores/ui';

const NAV: ReadonlyArray<{ page: Page; icon: typeof Library; label: MessageKey }> = [
  { page: 'library', icon: Library, label: 'nav.library' },
  { page: 'downloads', icon: Download, label: 'nav.downloads' },
  { page: 'settings', icon: Settings, label: 'nav.settings' },
];

export function Sidebar() {
  const t = useT();
  const page = useUi((s) => s.page);
  const setPage = useUi((s) => s.setPage);
  const jobs = useJobs((s) => s.jobs);
  const active = useMemo(() => jobs.filter(isActiveJob).length, [jobs]);

  return (
    <nav className="sidebar" aria-label="Downtube">
      {NAV.map(({ page: target, icon: Icon, label }) => (
        <button
          key={target}
          type="button"
          className={`nav-item${page === target ? ' is-active' : ''}`}
          aria-current={page === target ? 'page' : undefined}
          onClick={() => setPage(target)}
        >
          <Icon size={18} aria-hidden="true" />
          <span>{t(label)}</span>
          {target === 'downloads' && active > 0 && <span className="nav-badge">{active}</span>}
        </button>
      ))}
    </nav>
  );
}
