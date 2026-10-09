import { useT } from '../i18n';

export function SetupPage() {
  const t = useT();
  return <h1 className="page-title">{t('setup.title')}</h1>;
}
