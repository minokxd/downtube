import { estimateBytes } from '@shared/size-estimate';
import { spotifyUrl } from '@shared/spotify-url';
import type {
  LibraryItem,
  MediaKind,
  NewJobInput,
  ProbeEntry,
  ProbeList,
  ProbeVideo,
  Quality,
  SpotifyList,
  SpotifyTrack,
} from '@shared/types';

export interface DownloadChoice {
  kind: MediaKind;
  quality: Quality;
  subtitles: boolean;
}

export interface SizeInfo {
  bytes: number;
  /** Worked out from durations rather than YouTube's file list. */
  estimated: boolean;
  /** The real total is higher: some durations are unknown, or best video was counted as 1080p. */
  atLeast: boolean;
}

/** Duration-based total for playlist/channel entries; undefined when no duration is known. */
export function listSize(entries: readonly { durationSec?: number }[], kind: MediaKind, quality: Quality): SizeInfo | undefined {
  let bytes = 0;
  let counted = 0;
  for (const entry of entries) {
    if (entry.durationSec === undefined) continue;
    bytes += estimateBytes(entry.durationSec, kind, quality);
    counted += 1;
  }
  if (counted === 0) return undefined;
  return { bytes, estimated: true, atLeast: counted < entries.length || (kind === 'video' && quality === 'best') };
}

/** YouTube's size for the chosen video quality; otherwise (and always for mp3) the duration estimate. */
export function videoSize(video: ProbeVideo, kind: MediaKind, quality: Quality): SizeInfo | undefined {
  const bytes = kind === 'video' ? video.sizes?.[quality] : undefined;
  return bytes !== undefined ? { bytes, estimated: false, atLeast: false } : listSize([video], kind, quality);
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

/**
 * Ids to submit for a playlist/channel: the chosen entries plus the already-owned ones of the loaded list.
 * Main skips the owned ones as in-library but attaches them to the new collection, so it is not left partial.
 */
export function listSubmitIds(
  entries: readonly ProbeEntry[],
  chosen: readonly ProbeEntry[],
  owned: ReadonlySet<string>,
): Set<string> {
  return new Set([...chosen, ...entries.filter((entry) => owned.has(entry.videoId))].map((entry) => entry.videoId));
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

/** Spotify ids of the songs already in the library from a Spotify link. */
export function ownedSpotifyIds(items: readonly LibraryItem[]): Set<string> {
  return new Set(items.flatMap((item) => (item.kind === 'audio' && !item.missing && item.spotify ? [item.spotify.id] : [])));
}

export const songLabel = (track: SpotifyTrack): string => (track.artist ? `${track.artist} - ${track.title}` : track.title);

/**
 * One MP3 job per chosen song, matched to YouTube when it starts. Albums and playlists also become a
 * collection; like listSubmitIds, `selected` should include the owned songs so they join it too.
 */
export function spotifyJobs(
  list: SpotifyList,
  tracks: readonly SpotifyTrack[],
  selected: ReadonlySet<string>,
  quality: Quality,
): NewJobInput[] {
  const jobs: NewJobInput[] = [];
  tracks.forEach((track, index) => {
    if (!selected.has(track.id)) return;
    const job: NewJobInput = {
      url: spotifyUrl('track', track.id),
      videoId: '',
      title: songLabel(track),
      kind: 'audio',
      quality,
      subtitles: false,
      spotify: track,
    };
    const thumbnailUrl = track.coverUrl ?? list.coverUrl;
    if (thumbnailUrl) job.thumbnailUrl = thumbnailUrl;
    if (list.kind !== 'track') {
      job.collection = { youtubeId: `spotify-${list.id}`, kind: list.kind === 'album' ? 'album' : 'playlist', title: list.title, index };
    }
    jobs.push(job);
  });
  return jobs;
}

export function mergeTracks(current: readonly SpotifyTrack[], incoming: readonly SpotifyTrack[]): SpotifyTrack[] {
  const seen = new Set(current.map((track) => track.id));
  return [...current, ...incoming.filter((track) => !seen.has(track.id) && seen.add(track.id))];
}
