import { useT } from '../i18n';

export function LibraryPage() {
  const t = useT();
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('library.title')}</h1>
      </div>
    </div>
  );
}
