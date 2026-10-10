import { describe, expect, it } from 'vitest';
import { chaptersFromYtdlp, cleanChapters } from '../../src/shared/chapters';

describe('chaptersFromYtdlp', () => {
  it('maps yt-dlp chapters to seconds and titles', () => {
    expect(
      chaptersFromYtdlp([
        { start_time: 0, title: 'Intro', end_time: 15 },
        { start_time: 15, title: 'Step 1', end_time: 60 },
      ]),
    ).toEqual([
      { startSec: 0, endSec: 15, title: 'Intro' },
      { startSec: 15, endSec: 60, title: 'Step 1' },
    ]);
  });

  it('gives no chapters for missing or malformed data', () => {
    expect(chaptersFromYtdlp(undefined)).toEqual([]);
    expect(chaptersFromYtdlp('nope')).toEqual([]);
    expect(chaptersFromYtdlp([{ start_time: 'a', end_time: 2, title: 'x' }])).toEqual([]);
  });
});

describe('cleanChapters', () => {
  const chapter = (startSec: number, endSec: number, title = `T${startSec}`) => ({ startSec, endSec, title });

  it('sorts by start time and trims titles', () => {
    expect(cleanChapters([chapter(10, 20, '  Second  '), chapter(0, 10, 'First')])).toEqual([
      chapter(0, 10, 'First'),
      chapter(10, 20, 'Second'),
    ]);
  });

  it('drops entries with bad times or no title', () => {
    expect(
      cleanChapters([chapter(0, 10), chapter(10, 5), chapter(-1, 3), chapter(20, 30, '   '), { startSec: 30 }, null, chapter(40, 50)]),
    ).toEqual([chapter(0, 10), chapter(40, 50)]);
  });

  it('needs at least two chapters to be useful', () => {
    expect(cleanChapters([chapter(0, 10)])).toEqual([]);
    expect(cleanChapters('nope')).toEqual([]);
  });

  it('keeps at most 500 chapters and cuts very long titles', () => {
    const many = Array.from({ length: 600 }, (_, i) => chapter(i, i + 1));
    expect(cleanChapters(many)).toHaveLength(500);
    expect(cleanChapters([chapter(0, 1, 'x'.repeat(400)), chapter(1, 2)])[0]?.title).toHaveLength(200);
  });
});
