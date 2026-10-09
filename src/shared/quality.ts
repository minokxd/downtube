import type { Quality } from './types';

const CAPS = ['1080', '720', '480'] as const;

export function availableQualities(heights: readonly number[]): Quality[] {
  const max = heights.reduce((highest, h) => (h > highest ? h : highest), 0);
  const result: Quality[] = ['best'];
  for (const cap of CAPS) if (max >= Number(cap)) result.push(cap);
  return result;
}

export function pickDefaultQuality(available: readonly Quality[], preferred: Quality): Quality {
  return available.includes(preferred) ? preferred : 'best';
}
