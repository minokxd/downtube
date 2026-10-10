import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function ffmpeg(args: string[]): void {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${result.stderr || result.error?.message}`);
}

export interface Fixture {
  root: string;
  userData: string;
}

/** Creates a separate profile with two videos (the first with chapters) and one song, generated locally by ffmpeg. */
export async function createFixture(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), 'downtube-e2e-'));
  const userData = join(root, 'userData');
  const videoDir = join(root, 'Downtube', 'Video');
  const musicDir = join(root, 'Downtube', 'Müzik');
  await Promise.all([mkdir(userData, { recursive: true }), mkdir(videoDir, { recursive: true }), mkdir(musicDir, { recursive: true })]);

  const video = join(videoDir, 'Sample video [e2eVideo001].mp4');
  const videoThumb = join(videoDir, 'Sample video [e2eVideo001].jpg');
  const song = join(musicDir, 'Sample song [e2eAudio001].mp3');
  const songThumb = join(musicDir, 'Sample song [e2eAudio001].jpg');
  const second = join(videoDir, 'Second video [e2eVideo002].mp4');
  const secondThumb = join(videoDir, 'Second video [e2eVideo002].jpg');
  ffmpeg([
    '-f', 'lavfi', '-i', 'testsrc2=duration=6:size=640x360:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=330:duration=6',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', video,
  ]);
  ffmpeg([
    '-f', 'lavfi', '-i', 'testsrc2=duration=4:size=640x360:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', second,
  ]);
  ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=523:duration=6', '-c:a', 'libmp3lame', '-q:a', '4', song]);
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x2a2638:size=640x360', '-frames:v', '1', videoThumb]);
  await copyFile(videoThumb, songThumb);
  await copyFile(videoThumb, secondThumb);

  const now = new Date().toISOString();
  // The third title is the placeholder YouTube gives chapters that have no name.
  const chapters = [
    { startSec: 0, endSec: 2, title: 'Intro' },
    { startSec: 2, endSec: 4, title: 'Middle part' },
    { startSec: 4, endSec: 6, title: '<Untitled Chapter 3>' },
  ];
  const base = {
    subtitles: [],
    sizeBytes: 1,
    addedAt: now,
    collectionIds: [],
    progress: { positionSec: 0, updatedAt: now, completed: false },
    playCount: 0,
  };
  const library = {
    version: 1,
    items: [
      { ...base, id: 'e2e-video', videoId: 'e2eVideo001', kind: 'video', title: 'Sample video', channel: 'Downtube', durationSec: 6, filePath: video, thumbPath: videoThumb, sourceUrl: 'https://www.youtube.com/watch?v=e2eVideo001', chapters },
      { ...base, id: 'e2e-audio', videoId: 'e2eAudio001', kind: 'audio', title: 'Sample song', channel: 'Downtube', artist: 'Downtube', durationSec: 6, filePath: song, thumbPath: songThumb, sourceUrl: 'https://www.youtube.com/watch?v=e2eAudio001' },
      { ...base, id: 'e2e-video-2', videoId: 'e2eVideo002', kind: 'video', title: 'Second video', channel: 'Downtube', durationSec: 4, filePath: second, thumbPath: secondThumb, sourceUrl: 'https://www.youtube.com/watch?v=e2eVideo002' },
    ],
    collections: [],
  };
  await writeFile(join(userData, 'library.json'), JSON.stringify(library), 'utf8');
  await writeFile(
    join(userData, 'settings.json'),
    JSON.stringify({ theme: 'dark', language: 'tr', downloadDir: join(root, 'Downtube'), clipboardWatch: false }),
    'utf8',
  );
  return { root, userData };
}
