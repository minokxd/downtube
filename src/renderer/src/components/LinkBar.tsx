import { Link } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { isSupportedLink } from '@shared/spotify-url';
import { useT } from '../i18n';
import { useUi } from '../stores/ui';

export function LinkBar() {
  const t = useT();
  const openAdd = useUi((s) => s.openAdd);
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const url = value.trim();
    if (!url) return;
    if (!isSupportedLink(url)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setValue('');
    openAdd(url);
  };

  return (
    <form className={`linkbar${invalid ? ' has-error' : ''}`} onSubmit={submit}>
      <Link size={16} className="linkbar-icon" aria-hidden="true" />
      <input
        className="linkbar-input"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setInvalid(false);
        }}
        placeholder={t('linkbar.placeholder')}
        aria-label={t('linkbar.placeholder')}
        aria-invalid={invalid}
        spellCheck={false}
      />
      {invalid && (
        <span className="linkbar-error" role="alert">
          {t('linkbar.invalid')}
        </span>
      )}
      <button type="submit" className="btn btn-primary btn-sm">
        {t('linkbar.add')}
      </button>
    </form>
  );
}
