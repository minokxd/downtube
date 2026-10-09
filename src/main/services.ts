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
import { outputDirFor } from './ytdlp/args';
import { YtdlpClient } from './ytdlp/client';

export interface Services {
  settings: SettingsStore;
  library: LibraryStore;
  engine: Engine;
  ytdlp: YtdlpClient;
  queue: DownloadQueue;
  isUpdating(): boolean;
  setUpdating(value: boolean): void;
  shutdown(): Promise<void>;
}

export interface ServiceOptions {
  userData: string;
  videosDir: string;
  fetchImpl: FetchLike;
}

export async function createServices(options: ServiceOptions): Promise<Services> {
  const settings = await SettingsStore.open(join(options.userData, 'settings.json'), defaultSettings(options.videosDir));
  const library = await LibraryStore.open(join(options.userData, 'library.json'));
  const engine = new Engine({ binDir: join(options.userData, 'bin'), fetchImpl: options.fetchImpl });
  await engine.status();
  const ytdlp = new YtdlpClient({ getPaths: () => engine.paths() });
  const jobsFile = new JsonFile<Job[]>(join(options.userData, 'jobs.json'));
  const { value: savedJobs } = await jobsFile.read(() => [], sanitizeJobs);
  let updating = false;

  const queue = new DownloadQueue(
    {
      startDownload: (job, onEvent) => {
        const current = settings.get();
        return ytdlp.download(
          {
            url: job.url,
            kind: job.kind,
            quality: job.quality,
            subtitles: job.subtitles,
            subtitleLangs: current.subtitles.langs,
            includeAutoSubs: current.subtitles.includeAuto,
            outputDir: outputDirFor(current.downloadDir, job.kind),
          },
          onEvent,
        );
      },
      onCompleted: async (job, done) => {
        const sidecars = await findSidecars(done.filepath);
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
        });
        return item.id;
      },
      isInLibrary: (videoId, kind) => library.hasPlayable(videoId, kind),
      attachToCollection: (videoId, kind, ref) => library.attachExisting(videoId, kind, ref),
      cleanupPartials: async (job) => {
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
