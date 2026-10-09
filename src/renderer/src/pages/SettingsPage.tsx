import { useT } from '../i18n';

export function SettingsPage() {
  const t = useT();
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('settings.title')}</h1>
      </div>
    </div>
  );
}
