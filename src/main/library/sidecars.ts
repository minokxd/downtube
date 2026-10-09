import { promises as fs } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import type { SubtitleTrack } from '@shared/types';

export async function findSidecars(mediaPath: string): Promise<{ thumbPath?: string; subtitles: SubtitleTrack[] }> {
  const dir = dirname(mediaPath);
  const base = basename(mediaPath, extname(mediaPath));
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return { subtitles: [] };
  }
  let thumbPath: string | undefined;
  for (const ext of ['.jpg', '.webp', '.png']) {
    if (names.includes(base + ext)) {
      thumbPath = join(dir, base + ext);
      break;
    }
  }
  const prefix = `${base}.`;
  const subtitles: SubtitleTrack[] = [];
  for (const name of names) {
    if (!name.startsWith(prefix) || !name.endsWith('.vtt')) continue;
    const lang = name.slice(prefix.length, -'.vtt'.length);
    if (!lang || lang.includes('.')) continue;
    subtitles.push({ lang, label: lang, path: join(dir, name) });
  }
  subtitles.sort((a, b) => a.lang.localeCompare(b.lang));
  return thumbPath ? { thumbPath, subtitles } : { subtitles };
}
