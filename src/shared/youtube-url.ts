export type UrlInfo =
  | { kind: 'video'; videoId: string; url: string; listId?: string }
  | { kind: 'playlist'; listId: string; url: string }
  | { kind: 'channel'; url: string }
  | { kind: 'invalid' };

const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be']);
export const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const LIST_ID_RE = /^[A-Za-z0-9_-]{2,64}$/;
const INVALID: UrlInfo = { kind: 'invalid' };

const watchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`;

function video(videoId: string, listId: string | null): UrlInfo {
  if (listId && LIST_ID_RE.test(listId)) return { kind: 'video', videoId, url: watchUrl(videoId), listId };
  return { kind: 'video', videoId, url: watchUrl(videoId) };
}

export function classifyUrl(input: string): UrlInfo {
  const text = input.trim();
  if (text.length === 0 || text.length > 2048 || /\s/.test(text)) return INVALID;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return INVALID;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return INVALID;
  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) return INVALID;

  const listId = url.searchParams.get('list');
  const parts = url.pathname.split('/').filter(Boolean);
  const first = parts[0] ?? '';

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    return VIDEO_ID_RE.test(first) ? video(first, listId) : INVALID;
  }
  if (first === 'watch') {
    const id = url.searchParams.get('v') ?? '';
    return VIDEO_ID_RE.test(id) ? video(id, listId) : INVALID;
  }
  if (['shorts', 'live', 'embed', 'v'].includes(first)) {
    const id = parts[1] ?? '';
    return VIDEO_ID_RE.test(id) ? video(id, listId) : INVALID;
  }
  if (first === 'playlist') {
    return listId && LIST_ID_RE.test(listId)
      ? { kind: 'playlist', listId, url: `https://www.youtube.com/playlist?list=${listId}` }
      : INVALID;
  }
  if (first.startsWith('@') && first.length > 1) {
    return { kind: 'channel', url: `https://www.youtube.com/${first}/videos` };
  }
  if (['channel', 'c', 'user'].includes(first) && parts[1]) {
    return { kind: 'channel', url: `https://www.youtube.com/${first}/${parts[1]}/videos` };
  }
  return INVALID;
}

export const isYoutubeUrl = (input: string): boolean => classifyUrl(input).kind !== 'invalid';
