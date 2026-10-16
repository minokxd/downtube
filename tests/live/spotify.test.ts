import { execFile } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Engine } from '../../src/main/engine/engine';
import { findSidecars } from '../../src/main/library/sidecars';
import { SpotifyClient } from '../../src/main/spotify/client';
import { parseSearch, pickMatch } from '../../src/main/spotify/match';
import { applySpotifyTags } from '../../src/main/spotify/tags';
import { outputDirFor, type EnginePaths } from '../../src/main/ytdlp/args';
import { YtdlpClient } from '../../src/main/ytdlp/client';
import type { DoneInfo } from '../../src/main/ytdlp/output';

// Real network test against Spotify and YouTube. Run with `npm run test:live`.
const SONG = 'https://open.spotify.com/track/6OmhkSOpvYBokMKQxpIGx2'; // Pitbull, Sensato - Global Warming (85 s)
const ALBUM = 'https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy';
const PLAYLIST = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
const BIN = resolve('tests/.tmp/live-bin');
const fetchImpl = (url: string, init?: RequestInit) => fetch(url, init);

let paths: EnginePaths;
let client: YtdlpClient;
let out: string;
const spotify = new SpotifyClient(fetchImpl);

beforeAll(async () => {
  const engine = new Engine({ binDir: BIN, fetchImpl });
  if (!(await engine.status()).ready) await engine.install(() => undefined);
  paths = engine.paths()!;
  expect(paths).not.toBeNull();
  client = new YtdlpClient({ getPaths: () => paths });
  out = await mkdtemp(join(tmpdir(), 'downtube-spotify-'));
});

afterAll(async () => {
  if (out) await rm(out, { recursive: true, force: true });
});

describe('live Spotify', () => {
  it('reads an album', async () => {
    const list = await spotify.probe(ALBUM);
    expect(list).toMatchObject({ kind: 'album', title: 'Global Warming', owner: 'Pitbull', hasMore: false });
    expect(list.tracks.length).toBeGreaterThan(10);
    expect(list.tracks[0]).toMatchObject({ album: 'Global Warming', trackNumber: 1 });
  });

  it('reads a playlist with each song’s album and cover', async () => {
    const list = await spotify.probe(PLAYLIST);
    expect(list.partial).toBeUndefined();
    expect(list.totalCount).toBeGreaterThan(0);
    expect(list.tracks.length).toBe(Math.min(list.totalCount ?? 0, 100));
    expect(list.tracks.every((track) => track.album && track.coverUrl)).toBe(true);
  });

  it('matches a song on YouTube and downloads it with Spotify tags', async () => {
    const [track] = (await spotify.probe(SONG)).tracks;
    expect(track).toMatchObject({ title: 'Global Warming (feat. Sensato)', artist: 'Pitbull, Sensato' });
    const search = await client.searchSong(track!).done;
    const hit = pickMatch(track!, parseSearch(search.stdout));
    expect(hit, search.log).toBeDefined();

    let done: DoneInfo | undefined;
    const result = await client.download(
      {
        url: `https://www.youtube.com/watch?v=${hit!.id}`,
        kind: 'audio',
        quality: 'best',
        subtitles: false,
        subtitleLangs: [],
        includeAutoSubs: false,
        outputDir: outputDirFor(out, 'audio'),
      },
      (event) => {
        if (event.type === 'done') done = event.info;
      },
    ).done;
    expect(result.code, result.log).toBe(0);
    expect(Math.abs((done!.durationSec ?? 0) - (track!.durationSec ?? 0))).toBeLessThanOrEqual(5);

    const sidecars = await findSidecars(done!.filepath);
    const thumb = await applySpotifyTags({
      ffmpeg: join(paths.ffmpegDir, 'ffmpeg.exe'),
      filePath: done!.filepath,
      thumbPath: sidecars.thumbPath,
      track: track!,
      fetchImpl,
    });
    expect(thumb?.endsWith('.jpg')).toBe(true);
    expect((await stat(done!.filepath)).size).toBeGreaterThan(100_000);

    const { stdout } = await promisify(execFile)(join(paths.ffmpegDir, 'ffprobe.exe'), [
      '-v', 'error', '-show_entries', 'format_tags=title,artist:stream=codec_type,width,height', '-of', 'json', done!.filepath,
    ]);
    const probe = JSON.parse(stdout) as { format: { tags: Record<string, string> }; streams: { codec_type: string; width?: number; height?: number }[] };
    expect(probe.format.tags).toMatchObject({ title: track!.title, artist: track!.artist });
    const cover = probe.streams.find((s) => s.codec_type === 'video');
    expect(cover?.width).toBe(cover?.height);
  });
});
