import { useCallback } from 'react';
import type { Language } from '@shared/types';
import { useSettings } from '../stores/settings';
import type { MessageKey } from './tr';
import { localeOf, translate, type TranslateVars } from './translate';

export type { MessageKey } from './tr';
export { localeOf, translate } from './translate';

export type Translate = (key: MessageKey, vars?: TranslateVars) => string;

export function useLanguage(): Language {
  return useSettings((s) => s.settings?.language ?? 'tr');
}

export function useLocale(): string {
  return localeOf(useLanguage());
}

export function useT(): Translate {
  const language = useLanguage();
  return useCallback<Translate>((key, vars) => translate(language, key, vars), [language]);
}
