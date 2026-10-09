import type { MediaKind, Quality } from './types';

// Measured on real downloads: an MP3 at --audio-quality 0 (LAME V0) averages ~240 kbps, and YouTube's
// h264 + AAC picks for music videos and talks average these totals. 'best' counts as 1080p because a
// flat playlist page does not say which videos go higher.
const MP3_BITS_PER_SEC = 240_000;
const VIDEO_BITS_PER_SEC: Record<Quality, number> = {
  best: 3_000_000,
  '1080': 3_000_000,
  '720': 1_300_000,
  '480': 700_000,
};

/** Rough download size from the duration alone, for when yt-dlp has not listed the formats. */
export function estimateBytes(durationSec: number, kind: MediaKind, quality: Quality): number {
  const bitsPerSec = kind === 'audio' ? MP3_BITS_PER_SEC : VIDEO_BITS_PER_SEC[quality];
  return Math.round((durationSec * bitsPerSec) / 8);
}
