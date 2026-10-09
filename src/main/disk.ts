import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';

type StatFs = (path: string) => Promise<{ bavail: number; bsize: number }>;

/**
 * Free bytes on the drive holding `path`. The download folder is only created by the first download,
 * so this climbs to the nearest folder that exists. Null when nothing up to the root can be read.
 */
export async function freeBytes(path: string, statfs: StatFs = (p) => fs.statfs(p)): Promise<number | null> {
  let current = path;
  for (;;) {
    try {
      const stats = await statfs(current);
      return stats.bavail * stats.bsize;
    } catch {
      const parent = dirname(current);
      if (parent === current) return null;
      current = parent;
    }
  }
}
