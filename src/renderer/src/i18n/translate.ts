import type { Language } from '@shared/types';
import { az } from './az';
import { da } from './da';
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fi } from './fi';
import { fr } from './fr';
import { ga } from './ga';
import { nb } from './nb';
import { ptBR } from './pt-BR';
import { ru } from './ru';
import { sv } from './sv';
import { tr, type MessageKey } from './tr';

export { localeOf } from '@shared/languages';

export type TranslateVars = Record<string, string | number>;

export const DICTIONARIES: Record<Language, Record<MessageKey, string>> = {
  en,
  tr,
  de,
  es,
  fr,
  'pt-BR': ptBR,
  ru,
  sv,
  nb,
  da,
  fi,
  ga,
  az,
};

export function translate(language: Language, key: MessageKey, vars?: TranslateVars): string {
  // A missing text falls back to English, the language most users can read.
  const template = DICTIONARIES[language]?.[key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
