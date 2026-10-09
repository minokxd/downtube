import { describe, expect, it, vi } from 'vitest';
import { createProgressSaver } from '../../src/renderer/src/player/progress-saver';

describe('createProgressSaver', () => {
  it('saves at most once per interval and always on flush', () => {
    let now = 0;
    const save = vi.fn();
    const saver = createProgressSaver(save, 5000, () => now);
    saver.update('a', 1, 100);
    now = 3000;
    saver.update('a', 4, 100);
    expect(save).not.toHaveBeenCalled();
    now = 5000;
    saver.update('a', 6, 100);
    expect(save).toHaveBeenLastCalledWith('a', 6, 100);
    now = 6000;
    saver.flush('a', 7, 100);
    expect(save).toHaveBeenLastCalledWith('a', 7, 100);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('ignores invalid positions and unknown durations', () => {
    const save = vi.fn();
    const saver = createProgressSaver(save, 5000, () => 0);
    saver.flush('a', Number.NaN, 10);
    expect(save).not.toHaveBeenCalled();
    saver.flush('a', 3, Number.NaN);
    expect(save).toHaveBeenCalledWith('a', 3, undefined);
  });
});
