import type { CollectionKind, ProbeEntry, ProbeList, ProbeVideo } from '@shared/types';
import { VIDEO_ID_RE } from '@shared/youtube-url';
import { YtdlpError } from './errors';

type Json = Record<string, unknown>;

const str = (value: unknown): string | undefined => (typeof value === 'string' && value.length > 0 ? value : undefined);
const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const asObject = (value: unknown): Json => (typeof value === 'object' && value !== null ? (value as Json) : {});
const watchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`;

export function pickThumbnail(json: Json): string | undefined {
  const thumbs = Array.isArray(json.thumbnails) ? (json.thumbnails as unknown[]).map(asObject) : [];
  let best: { url: string; width: number } | undefined;
  for (const thumb of thumbs) {
    const url = str(thumb.url);
    if (!url) continue;
    const width = num(thumb.width) ?? 0;
    if (!best || width >= best.width) best = { url, width };
  }
  return best?.url ?? str(json.thumbnail);
}

export function normalizeVideo(raw: unknown, listId?: string): ProbeVideo {
  const json = asObject(raw);
  const id = str(json.id);
  if (!id) throw new YtdlpError('UNKNOWN', 'probe: missing video id');
  const formats = Array.isArray(json.formats) ? (json.formats as unknown[]).map(asObject) : [];
  const heights = [
    ...new Set(
      formats
        .filter((f) => typeof f.vcodec === 'string' && f.vcodec !== 'none' && num(f.height) !== undefined)
        .map((f) => f.height as number),
    ),
  ].sort((a, b) => a - b);
  const subtitles = Object.keys(asObject(json.subtitles)).filter((lang) => lang !== 'live_chat');
  const video: ProbeVideo = {
    videoId: id,
    url: watchUrl(id),
    title: str(json.title) ?? id,
    durationSec: num(json.duration),
    thumbnailUrl: str(json.thumbnail) ?? pickThumbnail(json),
    channel: str(json.channel) ?? str(json.uploader) ?? '',
    heights,
    hasSubtitles: subtitles.length > 0,
  };
  if (listId) video.listId = listId;
  return video;
}

const HIDDEN_TITLES = new Set(['[Private video]', '[Deleted video]']);

export function normalizeList(
  raw: unknown,
  listKind: CollectionKind,
  sourceUrl: string,
  start: number,
  pageSize: number,
): ProbeList {
  const json = asObject(raw);
  const rawEntries = Array.isArray(json.entries) ? (json.entries as unknown[]).map(asObject) : [];
  const entries: ProbeEntry[] = [];
  for (const entry of rawEntries) {
    const id = str(entry.id);
    if (!id || !VIDEO_ID_RE.test(id)) continue;
    const title = str(entry.title) ?? id;
    if (HIDDEN_TITLES.has(title)) continue;
    entries.push({
      videoId: id,
      url: watchUrl(id),
      title,
      durationSec: num(entry.duration),
      thumbnailUrl: pickThumbnail(entry),
      channel: str(entry.channel) ?? str(entry.uploader),
    });
  }
  const channel = str(json.channel) ?? str(json.uploader);
  const rawTitle = str(json.title) ?? '';
  const title = listKind === 'channel' ? (channel ?? rawTitle.replace(/ - (Videos|Shorts|Live)$/, '')) : rawTitle;
  const youtubeId = str(json.id) ?? str(json.channel_id) ?? '';
  return {
    listKind,
    youtubeId,
    title: title || youtubeId,
    channel,
    totalCount: num(json.playlist_count),
    entries,
    hasMore: rawEntries.length >= pageSize,
    nextStart: start + pageSize,
    sourceUrl,
  };
}
