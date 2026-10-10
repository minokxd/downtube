// Interface languages, each with its own name (as shown in the picker) and the locale used for dates and numbers.
export const LANGUAGES = [
  { code: 'en', name: 'English', locale: 'en-US' },
  { code: 'tr', name: 'Türkçe', locale: 'tr-TR' },
  { code: 'de', name: 'Deutsch', locale: 'de-DE' },
  { code: 'es', name: 'Español', locale: 'es-ES' },
  { code: 'fr', name: 'Français', locale: 'fr-FR' },
  { code: 'pt-BR', name: 'Português (Brasil)', locale: 'pt-BR' },
  { code: 'ru', name: 'Русский', locale: 'ru-RU' },
  { code: 'sv', name: 'Svenska', locale: 'sv-SE' },
  { code: 'nb', name: 'Norsk bokmål', locale: 'nb-NO' },
  { code: 'da', name: 'Dansk', locale: 'da-DK' },
  { code: 'ga', name: 'Gaeilge', locale: 'ga-IE' },
  { code: 'az', name: 'Azərbaycan dili', locale: 'az-AZ' },
] as const;

export type Language = (typeof LANGUAGES)[number]['code'];

export const isLanguage = (value: unknown): value is Language => LANGUAGES.some((language) => language.code === value);

/** The interface language for a system locale such as "de-AT": the matching language, or English. */
export function languageFromLocale(locale: string): Language {
  const base = locale.toLowerCase().split(/[-_]/)[0] ?? '';
  // Portuguese has one translation, and Norwegian Nynorsk users read Bokmål.
  if (base === 'pt') return 'pt-BR';
  if (base === 'no' || base === 'nn') return 'nb';
  return LANGUAGES.find((language) => language.code === base)?.code ?? 'en';
}

export function localeOf(language: Language): string {
  return LANGUAGES.find((entry) => entry.code === language)?.locale ?? 'en-US';
}

// YouTube names some subtitle languages differently from the interface languages.
const SUBTITLE_CODES: Partial<Record<Language, string>> = { 'pt-BR': 'pt', nb: 'no' };

/** Default subtitle languages: the interface language first, then English. */
export function subtitleLangsFor(language: Language): string[] {
  const own = SUBTITLE_CODES[language] ?? language;
  return own === 'en' ? ['en'] : [own, 'en'];
}
