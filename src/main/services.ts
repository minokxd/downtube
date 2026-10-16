import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { Job } from '@shared/types';
import type { FetchLike } from './engine/download';
import { Engine } from './engine/engine';
import { JsonFile } from './json-store';
import { LibraryStore } from './library/library-store';
import { findSidecars } from './library/sidecars';
import { cleanupPartialFiles } from './queue/cleanup';
import { DownloadQueue, sanitizeJobs } from './queue/queue';
import { SettingsStore, defaultSettings } from './settings';
import { SpotifyClient } from './spotify/client';
import { parseSearch, pickMatch } from './spotify/match';
import { applySpotifyTags } from './spotify/tags';
import { outputDirFor } from './ytdlp/args';
import { YtdlpClient } from './ytdlp/client';
import { chainRuns, failedRun } from './ytdlp/process';

export interface Services {
  settings: SettingsStore;
  library: LibraryStore;
  engine: Engine;
  ytdlp: YtdlpClient;
  spotify: SpotifyClient;
  queue: DownloadQueue;
  isUpdating(): boolean;
  setUpdating(value: boolean): void;
  shutdown(): Promise<void>;
}

export interface ServiceOptions {
  userData: string;
  videosDir: string;
  /** The system locale; picks the interface language on a first start. */
  locale?: string;
  fetchImpl: FetchLike;
}

export async function createServices(options: ServiceOptions): Promise<Services> {
  const settings = await SettingsStore.open(join(options.userData, 'settings.json'), defaultSettings(options.videosDir, options.locale));
  const library = await LibraryStore.open(join(options.userData, 'library.json'));
  const engine = new Engine({ binDir: join(options.userData, 'bin'), fetchImpl: options.fetchImpl });
  await engine.status();
  const ytdlp = new YtdlpClient({ getPaths: () => engine.paths() });
  const spotify = new SpotifyClient(options.fetchImpl);
  const jobsFile = new JsonFile<Job[]>(join(options.userData, 'jobs.json'));
  const { value: savedJobs } = await jobsFile.read(() => [], sanitizeJobs);
  let updating = false;

  const queue = new DownloadQueue(
    {
      startDownload: (job, onEvent) => {
        const download = (url: string) => {
          const current = settings.get();
          return ytdlp.download(
            {
              url,
              kind: job.kind,
              quality: job.quality,
              subtitles: job.subtitles,
              subtitleLangs: current.subtitles.langs,
              includeAutoSubs: current.subtitles.includeAuto,
              outputDir: outputDirFor(current.downloadDir, job.kind),
            },
            onEvent,
          );
        };
        const track = job.spotify;
        if (!track || job.videoId) return download(job.url);
        // A Spotify song is first matched to a YouTube recording, then downloaded like any video.
        return chainRuns(ytdlp.searchSong(track), (search) => {
          const hit = pickMatch(track, parseSearch(search.stdout));
          if (!hit) {
            if (search.code !== 0) return { done: Promise.resolve(search), cancel: () => undefined };
            return failedRun(`ERROR: [spotify] No match on YouTube for "${track.artist} - ${track.title}"`);
          }
          const url = `https://www.youtube.com/watch?v=${hit.id}`;
          onEvent({ type: 'matched', videoId: hit.id, url });
          return download(url);
        });
      },
      onCompleted: async (job, done) => {
        const sidecars = await findSidecars(done.filepath);
        const paths = engine.paths();
        if (job.spotify && paths) {
          sidecars.thumbPath = await applySpotifyTags({
            ffmpeg: join(paths.ffmpegDir, 'ffmpeg.exe'),
            filePath: done.filepath,
            thumbPath: sidecars.thumbPath,
            track: job.spotify,
            fetchImpl: options.fetchImpl,
          });
        }
        const sizeBytes = await fs.stat(done.filepath).then(
          (stat) => stat.size,
          () => 0,
        );
        const item = await library.addFromDownload({
          done,
          kind: job.kind,
          sourceUrl: job.url,
          collection: job.collection,
          thumbPath: sidecars.thumbPath,
          subtitles: sidecars.subtitles,
          sizeBytes,
          spotify: job.spotify,
        });
        return item.id;
      },
      isInLibrary: (videoId, kind, spotifyId) => library.hasPlayable(videoId, kind, spotifyId),
      attachToCollection: (videoId, kind, ref, spotifyId) => library.attachExisting(videoId, kind, ref, spotifyId),
      cleanupPartials: async (job) => {
        // An unmatched Spotify song has written nothing yet.
        if (!job.videoId) return;
        await cleanupPartialFiles(outputDirFor(settings.get().downloadDir, job.kind), job.videoId);
      },
      persist: (jobs) => jobsFile.write(jobs),
      getConcurrency: () => settings.get().concurrency,
      canStart: () => !updating && engine.paths() !== null,
      emitIntervalMs: 250,
    },
    savedJobs,
  );

  settings.onChange(() => queue.pump());

  return {
    settings,
    library,
    engine,
    ytdlp,
    spotify,
    queue,
    isUpdating: () => updating,
    setUpdating: (value) => {
      updating = value;
    },
    shutdown: async () => {
      await queue.shutdown();
      await Promise.all([library.flush(), settings.flush(), jobsFile.idle()]);
    },
  };
}
