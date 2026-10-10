import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '@shared/languages';
import { tr, type MessageKey } from '../../src/renderer/src/i18n/tr';
import { DICTIONARIES, translate } from '../../src/renderer/src/i18n/translate';

const keys = Object.keys(tr).sort() as MessageKey[];
const codes = LANGUAGES.map((language) => language.code);
const vars = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

describe('i18n', () => {
  it('has a dictionary for every interface language', () => {
    expect(Object.keys(DICTIONARIES).sort()).toEqual([...codes].sort());
  });

  it.each(codes)('%s has every key, no empty text and the same placeholders as Turkish', (code) => {
    const dict = DICTIONARIES[code];
    expect(Object.keys(dict).sort()).toEqual(keys);
    for (const key of keys) {
      expect(dict[key].trim(), `${code} ${key}`).not.toBe('');
      expect(vars(dict[key]), `${code} ${key}`).toEqual(vars(tr[key]));
    }
  });

  it.each(codes)('%s uses no long dashes', (code) => {
    for (const [key, value] of Object.entries(DICTIONARIES[code])) expect(value, `${code} ${key}`).not.toMatch(/[\u2013\u2014]/);
  });

  it('interpolates variables and keeps unknown placeholders', () => {
    expect(translate('tr', 'add.queued', { count: 3 })).toBe('3 indirme sıraya eklendi');
    expect(translate('en', 'add.queued', { count: 3 })).toBe('3 downloads queued');
    expect(translate('en', 'add.queued')).toBe('{count} downloads queued');
  });
});
