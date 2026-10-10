import type { Chapter } from './types';

const MAX_CHAPTERS = 500;
const MAX_TITLE = 200;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * Keeps well-formed chapters ({ startSec, endSec, title }), sorted by start, with trimmed and capped titles.
 * A single chapter tells the viewer nothing, so anything shorter than two comes back empty.
 */
export function cleanChapters(raw: unknown): Chapter[] {
  if (!Array.isArray(raw)) return [];
  const chapters: Chapter[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const c = entry as Partial<Record<keyof Chapter, unknown>>;
    const title = typeof c.title === 'string' ? c.title.trim().slice(0, MAX_TITLE) : '';
    if (!finite(c.startSec) || !finite(c.endSec) || c.startSec < 0 || c.endSec <= c.startSec || title === '') continue;
    chapters.push({ startSec: c.startSec, endSec: c.endSec, title });
  }
  chapters.sort((a, b) => a.startSec - b.startSec);
  return chapters.length >= 2 ? chapters.slice(0, MAX_CHAPTERS) : [];
}

/** yt-dlp's `chapters` field ({ start_time, end_time, title }) as cleaned chapters. */
export function chaptersFromYtdlp(raw: unknown): Chapter[] {
  if (!Array.isArray(raw)) return [];
  return cleanChapters(
    raw.map((entry) => {
      const c = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {};
      return { startSec: c.start_time, endSec: c.end_time, title: c.title };
    }),
  );
}
