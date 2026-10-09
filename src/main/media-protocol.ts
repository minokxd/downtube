import { createReadStream, promises as fs } from 'node:fs';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import type { Collection, LibraryItem } from '@shared/types';

export const MEDIA_SCHEME = 'downtube-media';

export type MediaRequest = { kind: 'item' | 'thumb' | 'cover'; id: string } | { kind: 'sub'; id: string; lang: string };

const ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const LANG_RE = /^[A-Za-z0-9-]{1,20}$/;

export function parseMediaUrl(raw: string): MediaRequest | null {
  let url: URL;
  let parts: string[];
  try {
    url = new URL(raw);
    parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return null;
  }
  if (url.protocol !== `${MEDIA_SCHEME}:`) return null;
  const [id, lang] = parts;
  if (!id || !ID_RE.test(id)) return null;
  switch (url.hostname) {
    case 'item':
    case 'thumb':
    case 'cover':
      return parts.length === 1 ? { kind: url.hostname, id } : null;
    case 'sub':
      return parts.length === 2 && lang && LANG_RE.test(lang) ? { kind: 'sub', id, lang } : null;
    default:
      return null;
  }
}

export function parseRange(header: string | null | undefined, size: number): { start: number; end: number } | 'unsatisfiable' | null {
  if (!header) return null;
  const first = header.trim().split(',')[0]?.trim() ?? '';
  const match = /^bytes=(\d*)-(\d*)$/.exec(first);
  if (!match) return null;
  const [, startText = '', endText = ''] = match;
  if (startText === '' && endText === '') return null;
  let start: number;
  let end: number;
  if (startText === '') {
    const suffix = Number(endText);
    if (suffix === 0) return 'unsatisfiable';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText === '' ? size - 1 : Math.min(Number(endText), size - 1);
  }
  if (start >= size || start > end) return 'unsatisfiable';
  return { start, end };
}

const CONTENT_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.opus': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.vtt': 'text/vtt; charset=utf-8',
};

export function contentTypeFor(path: string): string {
  return CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

export async function fileResponse(path: string, rangeHeader: string | null): Promise<Response> {
  let size: number;
  try {
    const stat = await fs.stat(path);
    if (!stat.isFile()) return new Response('Not found', { status: 404 });
    size = stat.size;
  } catch {
    return new Response('Not found', { status: 404 });
  }
  // <video crossorigin> and <track> need CORS: the page and the media use different origins.
  const headers: Record<string, string> = {
    'Content-Type': contentTypeFor(path),
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
  };
  const range = parseRange(rangeHeader, size);
  if (range === 'unsatisfiable') {
    return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  const body = size === 0 ? null : (Readable.toWeb(createReadStream(path, { start, end })) as unknown as ReadableStream<Uint8Array>);
  if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  headers['Content-Length'] = String(size === 0 ? 0 : end - start + 1);
  return new Response(body, { status: range ? 206 : 200, headers });
}

export interface MediaLookup {
  get(id: string): LibraryItem | undefined;
  getCollection(id: string): Collection | undefined;
}

export function resolveMediaPath(request: MediaRequest, lookup: MediaLookup): string | undefined {
  if (request.kind === 'cover') return lookup.getCollection(request.id)?.thumbPath;
  const item = lookup.get(request.id);
  if (!item) return undefined;
  if (request.kind === 'sub') {
    const lang = request.lang;
    return item.subtitles.find((s) => s.lang === lang)?.path;
  }
  return request.kind === 'item' ? item.filePath : item.thumbPath;
}

export async function handleMediaRequest(request: Request, lookup: MediaLookup): Promise<Response> {
  const parsed = parseMediaUrl(request.url);
  const path = parsed ? resolveMediaPath(parsed, lookup) : undefined;
  if (!path) return new Response('Not found', { status: 404 });
  return fileResponse(path, request.headers.get('range'));
}
