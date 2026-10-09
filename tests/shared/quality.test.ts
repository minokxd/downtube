import { describe, expect, it } from 'vitest';
import { availableQualities, pickDefaultQuality } from '@shared/quality';

describe('availableQualities', () => {
  it('always offers best', () => {
    expect(availableQualities([])).toEqual(['best']);
    expect(availableQualities([144, 240])).toEqual(['best']);
  });

  it('offers every cap the video can reach', () => {
    expect(availableQualities([360, 720, 1080, 2160])).toEqual(['best', '1080', '720', '480']);
    expect(availableQualities([480])).toEqual(['best', '480']);
    expect(availableQualities([720, 360])).toEqual(['best', '720', '480']);
  });
});

describe('pickDefaultQuality', () => {
  it('uses the preferred quality when available', () => {
    expect(pickDefaultQuality(['best', '1080', '720'], '1080')).toBe('1080');
  });

  it('falls back to best', () => {
    expect(pickDefaultQuality(['best', '720', '480'], '1080')).toBe('best');
  });
});
