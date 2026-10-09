import { useEffect, useState } from 'react';
import type { ThemeSetting } from '@shared/types';
import { resolveTheme, type ResolvedTheme } from './theme';

const QUERY = '(prefers-color-scheme: dark)';

export function useAppliedTheme(setting: ThemeSetting | undefined): ResolvedTheme {
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  const resolved = resolveTheme(setting ?? 'system', prefersDark);
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    void window.downtube.app.setTitleBarTheme(resolved);
  }, [resolved]);
  return resolved;
}
