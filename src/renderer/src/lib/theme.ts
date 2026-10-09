import type { ThemeSetting } from '@shared/types';

export type ResolvedTheme = 'dark' | 'light';

export function resolveTheme(setting: ThemeSetting, prefersDark: boolean): ResolvedTheme {
  if (setting === 'system') return prefersDark ? 'dark' : 'light';
  return setting;
}
