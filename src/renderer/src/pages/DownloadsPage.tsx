import { useT } from '../i18n';

export function DownloadsPage() {
  const t = useT();
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('downloads.title')}</h1>
      </div>
    </div>
  );
}
