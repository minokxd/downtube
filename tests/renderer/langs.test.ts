import { describe, expect, it } from 'vitest';
import { languageLabel, parseLangs } from '../../src/renderer/src/lib/langs';

describe('parseLangs', () => {
  it('splits, trims and de-duplicates up to five codes', () => {
    expect(parseLangs(' tr, en ,en  de')).toEqual(['tr', 'en', 'de']);
    expect(parseLangs('a,b,c,d,e,f')).toHaveLength(5);
    expect(parseLangs('')).toEqual([]);
  });
});

describe('languageLabel', () => {
  it('names languages in the interface language', () => {
    expect(languageLabel('tr', 'tr')).toBe('Türkçe');
    expect(languageLabel('en', 'tr')).toBe('İngilizce');
    expect(languageLabel('en', 'en')).toBe('English');
    expect(languageLabel('tr', 'en')).toBe('Turkish');
  });

  it('falls back to the code', () => {
    expect(languageLabel('!!', 'en')).toBe('!!');
  });
});
