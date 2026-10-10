import type { Chapter } from '@shared/types';

/** The chapter playing at `time`: the last one that has started, or -1 before the first or without chapters. */
export function chapterIndexAt(chapters: readonly Chapter[], time: number): number {
  let found = -1;
  for (let i = 0; i < chapters.length; i++) {
    if ((chapters[i]?.startSec ?? Infinity) > time) break;
    found = i;
  }
  return found;
}

/** Where each chapter after the first starts on a seek bar, in percent of the duration. */
export function chapterMarks(chapters: readonly Chapter[], duration: number): number[] {
  if (!(duration > 0)) return [];
  return chapters.filter((c) => c.startSec > 0 && c.startSec < duration).map((c) => (c.startSec / duration) * 100);
}

// YouTube names chapters the uploader left blank like this; the interface shows "Chapter N" instead.
const UNTITLED = /^<Untitled Chapter \d+>$/;

export function chapterTitle(chapter: Chapter, index: number, untitled: (number: number) => string): string {
  return UNTITLED.test(chapter.title) ? untitled(index + 1) : chapter.title;
}
