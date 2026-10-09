import type { PlaybackProgress } from '@shared/types';

export const RESUME_MIN_SEC = 10;
export const COMPLETE_RATIO = 0.95;

export function resumeStart(progress: PlaybackProgress, durationSec: number): number {
  if (progress.completed) return 0;
  const position = progress.positionSec;
  if (!Number.isFinite(position) || position <= RESUME_MIN_SEC) return 0;
  if (durationSec > 0 && position >= durationSec * COMPLETE_RATIO) return 0;
  return position;
}
