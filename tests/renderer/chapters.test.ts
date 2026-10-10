import { describe, expect, it } from 'vitest';
import { chapterIndexAt, chapterMarks, chapterTitle } from '../../src/renderer/src/player/chapters';

const chapters = [
  { startSec: 0, endSec: 15, title: 'Intro' },
  { startSec: 15, endSec: 60, title: 'Knot' },
  { startSec: 60, endSec: 142, title: '<Untitled Chapter 3>' },
];

describe('chapterIndexAt', () => {
  it('finds the chapter that contains the time', () => {
    expect(chapterIndexAt(chapters, 0)).toBe(0);
    expect(chapterIndexAt(chapters, 14.9)).toBe(0);
    expect(chapterIndexAt(chapters, 15)).toBe(1);
    expect(chapterIndexAt(chapters, 200)).toBe(2);
  });

  it('gives -1 without chapters or before the first one', () => {
    expect(chapterIndexAt([], 10)).toBe(-1);
    expect(chapterIndexAt([{ startSec: 5, endSec: 9, title: 'Late' }], 1)).toBe(-1);
  });
});

describe('chapterMarks', () => {
  it('places a mark at each chapter start after the beginning, as a percentage', () => {
    expect(chapterMarks(chapters, 120)).toEqual([12.5, 50]);
  });

  it('has no marks until the duration is known', () => {
    expect(chapterMarks(chapters, 0)).toEqual([]);
    expect(chapterMarks(chapters, Number.NaN)).toEqual([]);
  });
});

describe('chapterTitle', () => {
  const untitled = (number: number) => `Chapter ${number}`;

  it('keeps real titles and names untitled chapters by their number', () => {
    expect(chapterTitle(chapters[1]!, 1, untitled)).toBe('Knot');
    expect(chapterTitle(chapters[2]!, 2, untitled)).toBe('Chapter 3');
  });
});
