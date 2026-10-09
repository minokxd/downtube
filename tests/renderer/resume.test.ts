import { describe, expect, it } from 'vitest';
import { resumeStart } from '../../src/renderer/src/player/resume';

const progress = (positionSec: number, completed = false) => ({ positionSec, completed, updatedAt: '' });

describe('resumeStart', () => {
  it('resumes from the saved position', () => {
    expect(resumeStart(progress(760), 3000)).toBe(760);
  });

  it('starts over near the beginning, near the end and after completion', () => {
    expect(resumeStart(progress(8), 3000)).toBe(0);
    expect(resumeStart(progress(2900), 3000)).toBe(0);
    expect(resumeStart(progress(760, true), 3000)).toBe(0);
  });

  it('resumes when the duration is unknown', () => {
    expect(resumeStart(progress(42), 0)).toBe(42);
  });
});
