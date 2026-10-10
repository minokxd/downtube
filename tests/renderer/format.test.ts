import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration, formatPercent, formatSpeed } from '../../src/renderer/src/lib/format';

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [59, '0:59'],
    [59.9, '0:59'],
    [61, '1:01'],
    [3661, '1:01:01'],
    [undefined, '--:--'],
    [Number.NaN, '--:--'],
    [-1, '--:--'],
  ])('formats %s', (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });
});

describe('formatBytes', () => {
  it('uses binary units and the locale', () => {
    expect(formatBytes(0, 'en-US')).toBe('0 B');
    expect(formatBytes(1536, 'en-US')).toBe('1.5 KB');
    expect(formatBytes(1536, 'tr-TR')).toBe('1,5 KB');
    expect(formatBytes(5 * 1024 * 1024, 'en-US')).toBe('5 MB');
    expect(formatBytes(undefined)).toBe('-');
  });
});

describe('formatSpeed and formatPercent', () => {
  it('format rates and percentages', () => {
    expect(formatSpeed(2048, 'en-US')).toBe('2 KB/s');
    expect(formatSpeed(undefined)).toBe('');
    expect(formatPercent(45.6, 'tr-TR')).toBe('%46');
    expect(formatPercent(45.6, 'en-US')).toBe('46%');
  });
});
