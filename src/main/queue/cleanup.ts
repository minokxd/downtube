import { promises as fs } from 'node:fs';
import { join } from 'node:path';

const PARTIAL = /\.(part|ytdl)$|\.part-Frag\d+$|\.temp\.[^.]+$|\.f\d+(?:-\d+)?\.[^.]+$/i;
const FINAL_MEDIA = /\.(mp4|mp3|m4a|webm|mkv)$/i;
const SIDECAR = /\.(jpg|webp|png|vtt|srt)$/i;

// File names always contain "[<videoId>]" (see OUTPUT_TEMPLATE), so cleanup never
// touches other videos.
export async function cleanupPartialFiles(dir: string, videoId: string): Promise<string[]> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const marker = `[${videoId}]`;
  const ours = names.filter((name) => name.includes(marker));
  const removed: string[] = [];
  const removeFile = async (name: string): Promise<void> => {
    try {
      // Files are often still locked right after taskkill, so let rm retry EBUSY/EPERM.
      await fs.rm(join(dir, name), { force: true, maxRetries: 5, retryDelay: 100 });
      removed.push(name);
    } catch {
      // a locked file is left behind; it is harmless
    }
  };
  for (const name of ours) if (PARTIAL.test(name)) await removeFile(name);
  const remaining = ours.filter((name) => !removed.includes(name));
  const hasFinalMedia = remaining.some((name) => FINAL_MEDIA.test(name));
  if (!hasFinalMedia) for (const name of remaining) if (SIDECAR.test(name)) await removeFile(name);
  return removed;
}
