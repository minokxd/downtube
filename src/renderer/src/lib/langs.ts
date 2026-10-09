import type { Language } from '@shared/types';

export function parseLangs(text: string): string[] {
  const codes = text
    .split(/[\s,]+/)
    .map((code) => code.trim())
    .filter(Boolean);
  return [...new Set(codes)].slice(0, 5);
}

export function languageLabel(code: string, uiLanguage: Language): string {
  try {
    const label = new Intl.DisplayNames([uiLanguage], { type: 'language' }).of(code);
    if (label && label !== code) return label.charAt(0).toLocaleUpperCase(uiLanguage) + label.slice(1);
  } catch {
    // not a valid language tag
  }
  return code;
}
