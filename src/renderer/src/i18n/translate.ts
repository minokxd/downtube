import type { Language } from '@shared/types';
import { en } from './en';
import { tr, type MessageKey } from './tr';

export type TranslateVars = Record<string, string | number>;

const DICTIONARIES: Record<Language, Record<MessageKey, string>> = { tr, en };

export function translate(language: Language, key: MessageKey, vars?: TranslateVars): string {
  const template = DICTIONARIES[language][key] ?? tr[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function localeOf(language: Language): string {
  return language === 'tr' ? 'tr-TR' : 'en-US';
}
