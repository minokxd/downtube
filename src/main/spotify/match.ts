import type { SpotifyTrack } from '@shared/types';
import { VIDEO_ID_RE } from '@shared/youtube-url';

export interface SearchHit {
  id: string;
  title: string;
  channel?: string;
  durationSec?: number;
}

export interface SearchResults {
  /** YouTube Music's "Songs" results: official audio, but the flat search gives only id and title. */
  songs: SearchHit[];
  /** Plain YouTube results, with channel and duration. */
  videos: SearchHit[];
}

const FEATURING = /\s*[([](?:feat\.?|ft\.?|featuring|with)\s[^)\]]*[)\]]/gi;
const DASH_FEATURING = /\s+-\s+(?:feat\.?|ft\.?|featuring|with)\s.*$/i;
const REMASTER = /\s+-\s+(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?(?:\s+version)?$/i;

/** The song title without "(feat. ...)" parts and remaster notes, which YouTube titles rarely carry. */
export function baseTitle(title: string): string {
  const base = title.replace(FEATURING, '').replace(DASH_FEATURING, '').replace(REMASTER, '').trim();
  return base || title.trim();
}

export function searchText(track: SpotifyTrack): string {
  return `${track.artist} ${baseTitle(track.title)}`.trim();
}

export const musicSearchUrl = (track: SpotifyTrack): string =>
  `https://music.youtube.com/search?q=${encodeURIComponent(searchText(track))}#songs`;

export const videoSearchUrl = (track: SpotifyTrack): string => `ytsearch5:${searchText(track)}`;

function words(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

// Versions that are not the studio recording unless Spotify's title says so. Another performance of
// the song is a weak match; a karaoke or sped-up remake is no match at all.
const OTHER_TAKE = ['live', 'remix', 'acoustic', 'unplugged'];
const REMAKE = ['karaoke', 'instrumental', 'cover', 'nightcore', 'sped', 'slowed', 'reverb', '8d'];

const SONG_BONUS = 5;
const MIN_COVERAGE = 0.6;
const MIN_SCORE = 7;

function score(track: SpotifyTrack, hit: SearchHit, rank: number, isSong: boolean, durationSec: number | undefined): number | null {
  const wanted = new Set(words(baseTitle(track.title)));
  const title = words(hit.title);
  const have = new Set(title);
  if (wanted.size === 0) return null;
  const coverage = [...wanted].filter((word) => have.has(word)).length / wanted.size;
  if (coverage < MIN_COVERAGE) return null;
  let total = coverage * 10 - rank * 0.5;
  if (isSong) total += SONG_BONUS;
  const own = new Set(words(track.title));
  const unasked = (word: string): boolean => have.has(word) && !own.has(word);
  if (REMAKE.some(unasked)) total -= 10;
  else if (OTHER_TAKE.some(unasked)) total -= 6;
  if (!isSong) {
    const artists = new Set(words(track.artist));
    const channel = words(hit.channel ?? '');
    if ([...title, ...channel].some((word) => artists.has(word))) total += 2;
    if (/ - topic$/i.test(hit.channel ?? '')) total += 2;
  }
  if (track.durationSec !== undefined && durationSec !== undefined) {
    const diff = Math.abs(durationSec - track.durationSec);
    if (diff <= 3) total += 3;
    else if (diff <= 10) total += 1;
    else if (diff > 30 && diff > track.durationSec * 0.15) total -= 8;
  }
  return total;
}

/** The YouTube recording that best matches a Spotify song, or undefined when nothing is close enough. */
export function pickMatch(track: SpotifyTrack, results: SearchResults): SearchHit | undefined {
  // The plain search often finds the same uploads, which tells the duration of a song result.
  const durations = new Map(results.videos.filter((hit) => hit.durationSec !== undefined).map((hit) => [hit.id, hit.durationSec]));
  let best: { hit: SearchHit; score: number } | undefined;
  const consider = (hits: SearchHit[], isSong: boolean): void => {
    hits.forEach((hit, rank) => {
      const value = score(track, hit, rank, isSong, hit.durationSec ?? durations.get(hit.id));
      if (value !== null && value >= MIN_SCORE && (!best || value > best.score)) best = { hit, score: value };
    });
  };
  consider(results.songs, true);
  consider(results.videos, false);
  return best?.hit;
}

/** Reads yt-dlp's -J output for the two searches, one JSON document per line. */
export function parseSearch(stdout: string): SearchResults {
  const results: SearchResults = { songs: [], videos: [] };
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim().startsWith('{')) continue;
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const target = json.extractor_key === 'YoutubeMusicSearchURL' ? results.songs : results.videos;
    for (const entry of Array.isArray(json.entries) ? (json.entries as unknown[]) : []) {
      if (typeof entry !== 'object' || entry === null) continue;
      const e = entry as Record<string, unknown>;
      if (typeof e.id !== 'string' || !VIDEO_ID_RE.test(e.id) || typeof e.title !== 'string') continue;
      const hit: SearchHit = { id: e.id, title: e.title };
      if (typeof e.channel === 'string' && e.channel) hit.channel = e.channel;
      if (typeof e.duration === 'number' && Number.isFinite(e.duration)) hit.durationSec = e.duration;
      target.push(hit);
    }
  }
  return results;
}
