import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { freeBytes } from '../../src/main/disk';

const enoent = (): never => {
  throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
};

describe('freeBytes', () => {
  it('reads the free space of a real folder', async () => {
    expect(await freeBytes(tmpdir())).toBeGreaterThan(0);
  });

  it('walks up to the nearest folder that exists, since the download folder is created lazily', async () => {
    const base = join('D:', 'Media');
    const seen: string[] = [];
    const statfs = async (path: string) => {
      seen.push(path);
      return path === base ? { bavail: 10, bsize: 4096 } : enoent();
    };
    expect(await freeBytes(join(base, 'Downtube', 'Video'), statfs)).toBe(40_960);
    expect(seen).toEqual([join(base, 'Downtube', 'Video'), join(base, 'Downtube'), base]);
  });

  it('returns null when no folder up to the root can be read', async () => {
    expect(await freeBytes(join('Q:', 'nowhere'), async () => enoent())).toBeNull();
  });
});
