import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Collection, LibraryItem } from '@shared/types';
import {
  contentTypeFor,
  fileResponse,
  handleMediaRequest,
  parseMediaUrl,
  parseRange,
  resolveMediaPath,
  type MediaLookup,
} from '../../src/main/media-protocol';

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('parseMediaUrl', () => {
  it('parses every supported kind', () => {
    expect(parseMediaUrl(`downtube-media://item/${ID}`)).toEqual({ kind: 'item', id: ID });
    expect(parseMediaUrl(`downtube-media://thumb/${ID}`)).toEqual({ kind: 'thumb', id: ID });
    expect(parseMediaUrl(`downtube-media://cover/${ID}`)).toEqual({ kind: 'cover', id: ID });
    expect(parseMediaUrl(`downtube-media://sub/${ID}/en-US`)).toEqual({ kind: 'sub', id: ID, lang: 'en-US' });
  });

  it.each([
    `https://item/${ID}`,
    'downtube-media://item/',
    'downtube-media://item/..%2F..%2Fwindows%2Fwin.ini',
    `downtube-media://file/${ID}`,
    `downtube-media://sub/${ID}`,
    `downtube-media://item/${ID}/extra`,
    'downtube-media://item/%E0%A4%A',
    'not a url',
  ])('rejects %s', (url) => {
    expect(parseMediaUrl(url)).toBeNull();
  });
});

describe('parseRange', () => {
  it.each([
    [null, null],
    ['bytes=0-', { start: 0, end: 999 }],
    ['bytes=100-199', { start: 100, end: 199 }],
    ['bytes=900-5000', { start: 900, end: 999 }],
    ['bytes=-100', { start: 900, end: 999 }],
    ['bytes=0-1,5-6', { start: 0, end: 1 }],
    ['items=0-1', null],
    ['bytes=1000-', 'unsatisfiable'],
    ['bytes=-0', 'unsatisfiable'],
    ['bytes=5-2', 'unsatisfiable'],
  ])('parses %j', (header, expected) => {
    expect(parseRange(header, 1000)).toEqual(expected);
  });
});

describe('contentTypeFor', () => {
  it('knows the formats Downtube writes', () => {
    expect(contentTypeFor('a.mp4')).toBe('video/mp4');
    expect(contentTypeFor('A.MP3')).toBe('audio/mpeg');
    expect(contentTypeFor('a.vtt')).toBe('text/vtt; charset=utf-8');
    expect(contentTypeFor('a.jpg')).toBe('image/jpeg');
    expect(contentTypeFor('a.bin')).toBe('application/octet-stream');
  });
});

describe('fileResponse', () => {
  let dir: string;
  let file: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'downtube-media-'));
    file = join(dir, 'clip.mp4');
    await writeFile(file, Buffer.from('0123456789'));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('serves the whole file', async () => {
    const res = await fileResponse(file, null);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('video/mp4');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(await res.text()).toBe('0123456789');
  });

  it('serves a byte range', async () => {
    const res = await fileResponse(file, 'bytes=2-5');
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 2-5/10');
    expect(res.headers.get('content-length')).toBe('4');
    expect(await res.text()).toBe('2345');
  });

  it('answers 416 for impossible ranges and 404 for missing files', async () => {
    expect((await fileResponse(file, 'bytes=50-')).status).toBe(416);
    expect((await fileResponse(join(dir, 'nope.mp4'), null)).status).toBe(404);
  });
});

describe('handleMediaRequest', () => {
  const item = {
    id: ID,
    filePath: 'C:\\media\\a.mp4',
    thumbPath: 'C:\\media\\a.jpg',
    subtitles: [{ lang: 'en', label: 'en', path: 'C:\\media\\a.en.vtt' }],
  } as LibraryItem;
  const collection = { id: ID, thumbPath: 'C:\\media\\cover.jpg' } as Collection;
  const lookup: MediaLookup = {
    get: (id) => (id === ID ? item : undefined),
    getCollection: (id) => (id === ID ? collection : undefined),
  };

  it('resolves paths from library ids only', () => {
    expect(resolveMediaPath({ kind: 'item', id: ID }, lookup)).toBe('C:\\media\\a.mp4');
    expect(resolveMediaPath({ kind: 'thumb', id: ID }, lookup)).toBe('C:\\media\\a.jpg');
    expect(resolveMediaPath({ kind: 'sub', id: ID, lang: 'en' }, lookup)).toBe('C:\\media\\a.en.vtt');
    expect(resolveMediaPath({ kind: 'sub', id: ID, lang: 'de' }, lookup)).toBeUndefined();
    expect(resolveMediaPath({ kind: 'cover', id: ID }, lookup)).toBe('C:\\media\\cover.jpg');
    expect(resolveMediaPath({ kind: 'item', id: 'other' }, lookup)).toBeUndefined();
  });

  it('returns 404 for unknown requests', async () => {
    expect((await handleMediaRequest(new Request('downtube-media://item/unknown-id'), lookup)).status).toBe(404);
    expect((await handleMediaRequest(new Request('downtube-media://bogus/x'), lookup)).status).toBe(404);
  });
});
