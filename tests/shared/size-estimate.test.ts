import { describe, expect, it } from 'vitest';
import { estimateBytes } from '../../src/shared/size-estimate';

describe('estimateBytes', () => {
  it('estimates an mp3 from the measured V0 bitrate', () => {
    // 635 s at 240 kbps; a real conversion of this length came out at 19.0 MB.
    expect(estimateBytes(635, 'audio', '1080')).toBe(19_050_000);
  });

  it('uses a lower bitrate for each lower video quality', () => {
    const at = (quality: '1080' | '720' | '480') => estimateBytes(60, 'video', quality);
    expect(at('1080')).toBe(22_500_000);
    expect(at('720')).toBeLessThan(at('1080'));
    expect(at('480')).toBeLessThan(at('720'));
  });

  it('treats best as 1080p because a list does not reveal resolutions', () => {
    expect(estimateBytes(60, 'video', 'best')).toBe(estimateBytes(60, 'video', '1080'));
  });

  it('ignores the quality for audio', () => {
    expect(estimateBytes(60, 'audio', '480')).toBe(estimateBytes(60, 'audio', 'best'));
  });
});
