import { describe, expect, it } from 'vitest';
import { en } from '../../src/renderer/src/i18n/en';
import { tr, type MessageKey } from '../../src/renderer/src/i18n/tr';
import { translate } from '../../src/renderer/src/i18n/translate';

describe('i18n', () => {
  it('has the same keys in every language', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort());
  });

  it('has no empty strings', () => {
    for (const dict of [tr, en]) for (const [key, value] of Object.entries(dict)) expect(value.trim(), key).not.toBe('');
  });

  it('uses the same placeholders in both languages', () => {
    const vars = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(tr) as MessageKey[]) expect(vars(en[key]), key).toEqual(vars(tr[key]));
  });

  it('interpolates variables and keeps unknown placeholders', () => {
    expect(translate('tr', 'add.queued', { count: 3 })).toBe('3 indirme sıraya eklendi');
    expect(translate('en', 'add.queued', { count: 3 })).toBe('3 downloads queued');
    expect(translate('en', 'add.queued')).toBe('{count} downloads queued');
  });
});
