import type { LibraryItem, MediaKind, NewJobInput, ProbeEntry, ProbeList, ProbeVideo, Quality } from '@shared/types';

export interface DownloadChoice {
  kind: MediaKind;
  quality: Quality;
  subtitles: boolean;
}

export function inLibraryIds(items: readonly LibraryItem[], kind: MediaKind): Set<string> {
  return new Set(items.filter((item) => item.kind === kind && !item.missing).map((item) => item.videoId));
}

export function videoJob(video: ProbeVideo, choice: DownloadChoice): NewJobInput {
  const job: NewJobInput = {
    url: video.url,
    videoId: video.videoId,
    title: video.title,
    kind: choice.kind,
    quality: choice.quality,
    subtitles: choice.kind === 'video' && choice.subtitles,
  };
  if (video.thumbnailUrl) job.thumbnailUrl = video.thumbnailUrl;
  return job;
}

export function listJobs(
  list: ProbeList,
  entries: readonly ProbeEntry[],
  selected: ReadonlySet<string>,
  choice: DownloadChoice,
): NewJobInput[] {
  const jobs: NewJobInput[] = [];
  entries.forEach((entry, index) => {
    if (!selected.has(entry.videoId)) return;
    const job: NewJobInput = {
      url: entry.url,
      videoId: entry.videoId,
      title: entry.title,
      kind: choice.kind,
      quality: choice.quality,
      subtitles: choice.kind === 'video' && choice.subtitles,
      collection: { youtubeId: list.youtubeId, kind: list.listKind, title: list.title, index },
    };
    if (entry.thumbnailUrl) job.thumbnailUrl = entry.thumbnailUrl;
    jobs.push(job);
  });
  return jobs;
}

export function mergeEntries(current: readonly ProbeEntry[], incoming: readonly ProbeEntry[]): ProbeEntry[] {
  const seen = new Set(current.map((entry) => entry.videoId));
  const merged = [...current];
  for (const entry of incoming) {
    if (seen.has(entry.videoId)) continue;
    seen.add(entry.videoId);
    merged.push(entry);
  }
  return merged;
}

export const playlistUrl = (listId: string): string => `https://www.youtube.com/playlist?list=${listId}`;
