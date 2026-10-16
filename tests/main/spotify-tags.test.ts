import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applySpotifyTags, tagArgs } from '../../src/main/spotify/tags';
import type { RunFn } from '../../src/main/ytdlp/process';

const track = {
  id: '3XmwAZpIMNpTJy8faw3ajD',
  title: 'expectations (feat. Chappell Roan)',
  artist: 'Olivia Rodrigo, Chappell Roan',
  album: 'expectations',
  albumArtist: 'Olivia Rodrigo',
  trackNumber: 1,
  coverUrl: 'https://i.scdn.co/image/cover',
};

describe('tagArgs', () => {
  it('copies the audio, sets the tags and attaches the new cover', () => {
    expect(tagArgs('in.mp3', 'out.mp3', track, 'cover.jpg')).toEqual([
      '-hide_banner', '-loglevel', 'error', '-y', '-i', 'in.mp3', '-i', 'cover.jpg',
      '-map', '0:a', '-map', '1:v', '-c', 'copy', '-map_metadata', '0', '-id3v2_version', '3',
      '-metadata', 'title=expectations (feat. Chappell Roan)',
      '-metadata', 'artist=Olivia Rodrigo, Chappell Roan',
      '-metadata', 'album=expectations',
      '-metadata', 'album_artist=Olivia Rodrigo',
      '-metadata', 'track=1',
      '-metadata:s:v', 'title=Album cover', '-metadata:s:v', 'comment=Cover (front)', '-disposition:v', 'attached_pic',
      'out.mp3',
    ]);
  });

  it('keeps the embedded cover and skips unknown tags', () => {
    const args = tagArgs('in.mp3', 'out.mp3', { id: track.id, title: 'Song', artist: '' });
    expect(args).toContain('0:v?');
    expect(args.filter((arg) => arg.startsWith('artist=') || arg.startsWith('album='))).toEqual([]);
  });
});

describe('applySpotifyTags', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'downtube-tags-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const fakeFfmpeg = (code: number): RunFn =>
    vi.fn((_exe: string, args: string[]) => {
      const output = args.at(-1) ?? '';
      const done = (code === 0 ? writeFile(output, 'tagged') : Promise.resolve()).then(() => ({ code, canceled: false, stdout: '', log: 'ffmpeg log' }));
      return { done, cancel: () => undefined };
    });

  it("replaces YouTube's thumbnail with Spotify's cover and the file with the tagged copy", async () => {
    const file = join(dir, 'Song [9KcnxA36s04].mp3');
    await writeFile(file, 'original');
    await writeFile(join(dir, 'Song [9KcnxA36s04].webp'), 'youtube thumb');
    const fetchImpl = vi.fn(async () => new Response('spotify cover'));
    const run = fakeFfmpeg(0);
    const thumb = await applySpotifyTags({ ffmpeg: 'ffmpeg.exe', filePath: file, thumbPath: join(dir, 'Song [9KcnxA36s04].webp'), track, fetchImpl, run });
    expect(thumb).toBe(join(dir, 'Song [9KcnxA36s04].jpg'));
    expect(await readFile(thumb!, 'utf8')).toBe('spotify cover');
    expect(await readFile(file, 'utf8')).toBe('tagged');
    expect((await readdir(dir)).sort()).toEqual(['Song [9KcnxA36s04].jpg', 'Song [9KcnxA36s04].mp3']);
    expect(fetchImpl).toHaveBeenCalledWith('https://i.scdn.co/image/cover', expect.anything());
  });

  it('keeps the file and thumbnail when the cover and ffmpeg fail', async () => {
    const file = join(dir, 'Song [9KcnxA36s04].mp3');
    const oldThumb = join(dir, 'Song [9KcnxA36s04].jpg');
    await writeFile(file, 'original');
    await writeFile(oldThumb, 'youtube thumb');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const thumb = await applySpotifyTags({
      ffmpeg: 'ffmpeg.exe',
      filePath: file,
      thumbPath: oldThumb,
      track,
      fetchImpl: async () => new Response('', { status: 500 }),
      run: fakeFfmpeg(1),
    });
    warn.mockRestore();
    expect(thumb).toBe(oldThumb);
    expect(await readFile(oldThumb, 'utf8')).toBe('youtube thumb');
    expect(await readFile(file, 'utf8')).toBe('original');
  });
});
