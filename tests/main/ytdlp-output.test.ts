import { describe, expect, it } from 'vitest';
import { LineSplitter, parseLine } from '../../src/main/ytdlp/output';

describe('parseLine', () => {
  it('parses a progress line', () => {
    expect(parseLine('DT_PROGRESS downloading|130048|433081|NA|64620405.94621491|0|133')).toEqual({
      type: 'progress',
      status: 'downloading',
      downloadedBytes: 130048,
      totalBytes: 433081,
      speedBps: 64620405.94621491,
      etaSec: 0,
      formatId: '133',
    });
  });

  it('treats NA as missing and uses the size estimate as a fallback', () => {
    expect(parseLine('DT_PROGRESS downloading|440|NA|NA|49094.03|NA|NA')).toEqual({
      type: 'progress',
      status: 'downloading',
      downloadedBytes: 440,
      totalBytes: undefined,
      speedBps: 49094.03,
      etaSec: undefined,
      formatId: undefined,
    });
    expect(parseLine('DT_PROGRESS downloading|10|NA|100|NA|NA|251')).toMatchObject({ totalBytes: 100, formatId: '251' });
  });

  it('parses postprocessor lines', () => {
    expect(parseLine('DT_PP Merger|started')).toEqual({ type: 'postprocess', name: 'Merger', status: 'started' });
  });

  it('parses the done line', () => {
    const line =
      'DT_DONE {"id": "abcdefghijk", "title": "Gülümse", "channel": null, "channel_id": "UC1", "uploader": "Sezen Aksu", ' +
      '"artist": null, "track": null, "duration": 221, "filepath": "C:\\\\Müzik\\\\Gülümse [abcdefghijk].mp3"}';
    expect(parseLine(line)).toEqual({
      type: 'done',
      info: {
        id: 'abcdefghijk',
        title: 'Gülümse',
        channel: 'Sezen Aksu',
        channelId: 'UC1',
        artist: undefined,
        track: undefined,
        durationSec: 221,
        filepath: 'C:\\Müzik\\Gülümse [abcdefghijk].mp3',
      },
    });
  });

  it('carries the chapters of the done line, cleaned', () => {
    const line =
      'DT_DONE {"id": "thGMPoX29Vs", "title": "Tie", "duration": 142, "filepath": "C:\\\\v.mp4", "chapters": [' +
      '{"start_time": 15, "title": "Knot", "end_time": 60}, {"start_time": 0, "title": "Intro", "end_time": 15}]}';
    const event = parseLine(line);
    expect(event.type === 'done' && event.info.chapters).toEqual([
      { startSec: 0, endSec: 15, title: 'Intro' },
      { startSec: 15, endSec: 60, title: 'Knot' },
    ]);
  });

  it('leaves chapters out when the video has none', () => {
    const event = parseLine('DT_DONE {"id": "abcdefghijk", "filepath": "C:\\\\v.mp4", "chapters": null}');
    expect(event.type === 'done' && 'chapters' in event.info).toBe(false);
  });

  it('falls back to a log line for broken or unrelated output', () => {
    expect(parseLine('DT_DONE {broken')).toEqual({ type: 'log', line: 'DT_DONE {broken' });
    expect(parseLine('DT_DONE {"title": "no id"}')).toEqual({ type: 'log', line: 'DT_DONE {"title": "no id"}' });
    expect(parseLine('[youtube] jNQXAC9IVRw: Downloading webpage')).toEqual({
      type: 'log',
      line: '[youtube] jNQXAC9IVRw: Downloading webpage',
    });
  });
});

describe('LineSplitter', () => {
  it('joins chunks and splits on any newline style', () => {
    const lines: string[] = [];
    const splitter = new LineSplitter((line) => lines.push(line));
    splitter.push('a\r\nb');
    splitter.push('c\nd\re');
    splitter.push('\r\n\r\n');
    splitter.push('tail');
    splitter.flush();
    expect(lines).toEqual(['a', 'bc', 'd', 'e', 'tail']);
  });
});
