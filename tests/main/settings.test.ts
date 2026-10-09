import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SettingsStore,
  SettingsValidationError,
  applySettingsPatch,
  defaultSettings,
  sanitizeSettings,
} from '../../src/main/settings';

const defaults = defaultSettings(join(tmpdir(), 'Videos'));

describe('settings helpers', () => {
  it('has sensible defaults', () => {
    expect(defaults).toMatchObject({
      theme: 'system',
      language: 'tr',
      defaultQuality: '1080',
      concurrency: 2,
      subtitles: { enabled: true, langs: ['tr', 'en'], includeAuto: false },
      clipboardWatch: true,
    });
    expect(defaults.downloadDir).toBe(join(tmpdir(), 'Videos', 'Downtube'));
  });

  it('sanitize keeps valid fields and drops invalid or unknown ones', () => {
    const result = sanitizeSettings({ theme: 'neon', language: 'en', concurrency: 9, extra: true }, defaults);
    expect(result.theme).toBe('system');
    expect(result.language).toBe('en');
    expect(result.concurrency).toBe(2);
    expect(result).not.toHaveProperty('extra');
  });

  it('sanitize falls back to defaults for non-objects', () => {
    expect(sanitizeSettings(null, defaults)).toEqual(defaults);
    expect(sanitizeSettings([1, 2], defaults)).toEqual(defaults);
  });

  it('applySettingsPatch applies valid fields', () => {
    expect(applySettingsPatch(defaults, { theme: 'dark', concurrency: 4 })).toMatchObject({ theme: 'dark', concurrency: 4 });
  });

  it('applySettingsPatch rejects invalid fields and names them', () => {
    try {
      applySettingsPatch(defaults, { concurrency: 0, theme: 'dark' });
      expect.fail('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SettingsValidationError);
      expect((err as SettingsValidationError).fields).toEqual(['concurrency']);
    }
  });

  it('rejects relative download folders and unknown keys', () => {
    expect(() => applySettingsPatch(defaults, { downloadDir: 'relative/path' })).toThrow(SettingsValidationError);
    expect(() => applySettingsPatch(defaults, { nope: 1 })).toThrow(SettingsValidationError);
  });

  it('rejects inherited object property names as unknown keys', () => {
    expect(() => applySettingsPatch(defaults, { toString: 1 })).toThrow(SettingsValidationError);
    expect(() => applySettingsPatch(defaults, { constructor: 'x' })).toThrow(SettingsValidationError);
    expect(() => applySettingsPatch(defaults, JSON.parse('{"__proto__":{"a":1}}'))).toThrow(SettingsValidationError);
  });

  it('validates subtitle settings', () => {
    const ok = applySettingsPatch(defaults, { subtitles: { enabled: false, langs: ['tr', 'en-US'], includeAuto: true } });
    expect(ok.subtitles).toEqual({ enabled: false, langs: ['tr', 'en-US'], includeAuto: true });
    expect(() => applySettingsPatch(defaults, { subtitles: { enabled: true, langs: ['../x'], includeAuto: false } })).toThrow(
      SettingsValidationError,
    );
  });
});

describe('SettingsStore', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'downtube-settings-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('persists updates and notifies listeners', async () => {
    const file = join(dir, 'settings.json');
    const store = await SettingsStore.open(file, defaults);
    const listener = vi.fn();
    store.onChange(listener);
    await store.update({ theme: 'dark' });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }));
    const reopened = await SettingsStore.open(file, defaults);
    expect(reopened.get().theme).toBe('dark');
  });

  it('returns copies that cannot mutate the store', async () => {
    const store = await SettingsStore.open(join(dir, 'settings.json'), defaults);
    store.get().subtitles.langs.push('de');
    expect(store.get().subtitles.langs).toEqual(['tr', 'en']);
  });
});
