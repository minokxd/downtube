import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findSidecars } from '../../src/main/library/sidecars';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'downtube-sidecars-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('findSidecars', () => {
  it('finds the thumbnail and subtitles next to the media file', async () => {
    const base = 'Me at the zoo [jNQXAC9IVRw]';
    const names = [`${base}.mp4`, `${base}.jpg`, `${base}.en.vtt`, `${base}.tr.vtt`, `${base}.f137.mp4`, 'Other [aaaaaaaaaaa].en.vtt'];
    for (const name of names) await writeFile(join(dir, name), 'x');
    const result = await findSidecars(join(dir, `${base}.mp4`));
    expect(result.thumbPath).toBe(join(dir, `${base}.jpg`));
    expect(result.subtitles).toEqual([
      { lang: 'en', label: 'en', path: join(dir, `${base}.en.vtt`) },
      { lang: 'tr', label: 'tr', path: join(dir, `${base}.tr.vtt`) },
    ]);
  });

  it('returns nothing for a missing folder', async () => {
    expect(await findSidecars(join(dir, 'nope', 'file.mp4'))).toEqual({ subtitles: [] });
  });
});
