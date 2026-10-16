import { promises as fs } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import type { SpotifyTrack } from '@shared/types';
import type { FetchLike } from '../engine/download';
import { runProcess, type RunFn } from '../ytdlp/process';

/** ffmpeg arguments that copy the audio and set Spotify's tags, plus its cover when one is given. */
export function tagArgs(input: string, output: string, track: SpotifyTrack, coverPath?: string): string[] {
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', input];
  if (coverPath) args.push('-i', coverPath);
  // Without a new cover, the one yt-dlp embedded stays.
  args.push('-map', '0:a', '-map', coverPath ? '1:v' : '0:v?', '-c', 'copy', '-map_metadata', '0', '-id3v2_version', '3');
  const tags: Array<[string, string | number | undefined]> = [
    ['title', track.title],
    ['artist', track.artist],
    ['album', track.album],
    ['album_artist', track.albumArtist],
    ['track', track.trackNumber],
  ];
  for (const [name, value] of tags) if (value !== undefined && value !== '') args.push('-metadata', `${name}=${value}`);
  if (coverPath) args.push('-metadata:s:v', 'title=Album cover', '-metadata:s:v', 'comment=Cover (front)', '-disposition:v', 'attached_pic');
  args.push(output);
  return args;
}

export interface SpotifyTagInput {
  ffmpeg: string;
  filePath: string;
  thumbPath?: string;
  track: SpotifyTrack;
  fetchImpl: FetchLike;
  run?: RunFn;
}

async function saveCover(fetchImpl: FetchLike, url: string, dest: string): Promise<boolean> {
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return false;
    await fs.writeFile(dest, Buffer.from(await response.arrayBuffer()));
    return true;
  } catch (err) {
    console.warn('[spotify] cover download failed', err);
    return false;
  }
}

/**
 * Gives a downloaded MP3 Spotify's title, artist, album and square cover in place of YouTube's.
 * Best effort: on any failure the file keeps yt-dlp's tags. Returns the thumbnail to show.
 */
export async function applySpotifyTags(input: SpotifyTagInput): Promise<string | undefined> {
  const { filePath, track } = input;
  const base = join(dirname(filePath), basename(filePath, extname(filePath)));
  let thumbPath = input.thumbPath;
  let coverPath: string | undefined;
  if (track.coverUrl && (await saveCover(input.fetchImpl, track.coverUrl, `${base}.jpg`))) {
    coverPath = `${base}.jpg`;
    if (thumbPath && thumbPath !== coverPath) await fs.rm(thumbPath, { force: true }).catch(() => undefined);
    thumbPath = coverPath;
  }
  // ".temp." files are what cleanupPartialFiles removes if this is interrupted.
  const temp = `${base}.temp${extname(filePath)}`;
  const run = input.run ?? runProcess;
  const result = await run(input.ffmpeg, tagArgs(filePath, temp, track, coverPath)).done;
  try {
    if (result.code !== 0) throw new Error(result.log || `ffmpeg exited with ${result.code}`);
    await fs.rename(temp, filePath);
  } catch (err) {
    console.warn('[spotify] tagging failed', err);
    await fs.rm(temp, { force: true }).catch(() => undefined);
  }
  return thumbPath;
}
