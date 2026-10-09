import { isAbsolute, join } from 'node:path';
import { QUALITIES, type Quality, type Settings } from '@shared/types';
import { JsonFile, type RecoveryState } from './json-store';

export function defaultSettings(videosDir: string): Settings {
  return {
    theme: 'system',
    language: 'tr',
    downloadDir: join(videosDir, 'Downtube'),
    defaultQuality: '1080',
    concurrency: 2,
    subtitles: { enabled: true, langs: ['tr', 'en'], includeAuto: false },
    clipboardWatch: true,
  };
}

const LANG_CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;

type Validator = (value: unknown) => boolean;

const VALIDATORS: { [K in keyof Settings]-?: Validator } = {
  theme: (v) => v === 'system' || v === 'dark' || v === 'light',
  language: (v) => v === 'tr' || v === 'en',
  downloadDir: (v) => typeof v === 'string' && v.length > 0 && v.length < 1024 && isAbsolute(v),
  defaultQuality: (v) => QUALITIES.includes(v as Quality),
  concurrency: (v) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 4,
  subtitles: (v) => {
    if (typeof v !== 'object' || v === null) return false;
    const s = v as Record<string, unknown>;
    return (
      typeof s.enabled === 'boolean' &&
      typeof s.includeAuto === 'boolean' &&
      Array.isArray(s.langs) &&
      s.langs.length <= 5 &&
      s.langs.every((lang) => typeof lang === 'string' && LANG_CODE.test(lang))
    );
  },
  clipboardWatch: (v) => typeof v === 'boolean',
  lastYtdlpUpdateCheck: (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v)),
};

export class SettingsValidationError extends Error {
  constructor(readonly fields: string[]) {
    super(`Invalid settings: ${fields.join(', ')}`);
    this.name = 'SettingsValidationError';
  }
}

function splitPatch(patch: unknown): { valid: Partial<Settings>; invalid: string[] } {
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) return { valid: {}, invalid: ['<root>'] };
  const valid: Record<string, unknown> = {};
  const invalid: string[] = [];
  for (const [key, value] of Object.entries(patch)) {
    const check = Object.hasOwn(VALIDATORS, key) ? (VALIDATORS as Record<string, Validator>)[key] : undefined;
    if (check && check(value)) valid[key] = structuredClone(value);
    else invalid.push(key);
  }
  return { valid: valid as Partial<Settings>, invalid };
}

export function applySettingsPatch(current: Settings, patch: unknown): Settings {
  const { valid, invalid } = splitPatch(patch);
  if (invalid.length > 0) throw new SettingsValidationError(invalid);
  return { ...current, ...valid };
}

export function sanitizeSettings(raw: unknown, defaults: Settings): Settings {
  return { ...structuredClone(defaults), ...splitPatch(raw).valid };
}

export class SettingsStore {
  private readonly listeners = new Set<(settings: Settings) => void>();
  private queue: Promise<void> = Promise.resolve();

  private constructor(
    private readonly file: JsonFile<Settings>,
    private current: Settings,
    readonly recovered: RecoveryState,
  ) {}

  static async open(filePath: string, defaults: Settings): Promise<SettingsStore> {
    const file = new JsonFile<Settings>(filePath);
    const { value, recovered } = await file.read(
      () => structuredClone(defaults),
      (raw) => sanitizeSettings(raw, defaults),
    );
    return new SettingsStore(file, value, recovered);
  }

  get(): Settings {
    return structuredClone(this.current);
  }

  update(patch: unknown): Promise<Settings> {
    const run = async (): Promise<Settings> => {
      const candidate = applySettingsPatch(this.current, patch);
      await this.file.write(candidate);
      this.current = candidate;
      const snapshot = this.get();
      for (const listener of this.listeners) listener(snapshot);
      return snapshot;
    };
    const next = this.queue.then(run, run);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  onChange(listener: (settings: Settings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async flush(): Promise<void> {
    await this.queue;
    await this.file.idle();
  }
}
