import { describe, expect, it } from 'vitest';
import { LANGUAGES, isLanguage, languageFromLocale, localeOf, subtitleLangsFor } from '../../src/shared/languages';

describe('LANGUAGES', () => {
  it('lists thirteen languages with unique codes and valid locales', () => {
    expect(LANGUAGES).toHaveLength(13);
    expect(new Set(LANGUAGES.map((l) => l.code)).size).toBe(13);
    for (const language of LANGUAGES) expect(Intl.getCanonicalLocales(language.locale)).toHaveLength(1);
  });

  it('recognises only listed codes', () => {
    expect(isLanguage('de')).toBe(true);
    expect(isLanguage('pt-BR')).toBe(true);
    expect(isLanguage('ja')).toBe(false);
    expect(isLanguage(3)).toBe(false);
  });
});

describe('languageFromLocale', () => {
  it.each([
    ['tr', 'tr'],
    ['tr-TR', 'tr'],
    ['en-US', 'en'],
    ['de-AT', 'de'],
    ['es-419', 'es'],
    ['fr-CA', 'fr'],
    ['pt-PT', 'pt-BR'],
    ['pt-BR', 'pt-BR'],
    ['ru', 'ru'],
    ['sv-SE', 'sv'],
    ['nb', 'nb'],
    ['nn-NO', 'nb'],
    ['no', 'nb'],
    ['da', 'da'],
    ['fi-FI', 'fi'],
    ['ga-IE', 'ga'],
    ['az-Latn-AZ', 'az'],
    ['ja-JP', 'en'],
    ['', 'en'],
  ])('maps %j to %s', (locale, language) => {
    expect(languageFromLocale(locale)).toBe(language);
  });
});

describe('localeOf', () => {
  it('gives the formatting locale of a language', () => {
    expect(localeOf('tr')).toBe('tr-TR');
    expect(localeOf('pt-BR')).toBe('pt-BR');
    expect(localeOf('nb')).toBe('nb-NO');
  });
});

describe('subtitleLangsFor', () => {
  it('prefers subtitles in the interface language, then English', () => {
    expect(subtitleLangsFor('en')).toEqual(['en']);
    expect(subtitleLangsFor('tr')).toEqual(['tr', 'en']);
    expect(subtitleLangsFor('pt-BR')).toEqual(['pt', 'en']);
    expect(subtitleLangsFor('nb')).toEqual(['no', 'en']);
    expect(subtitleLangsFor('fi')).toEqual(['fi', 'en']);
  });
});
