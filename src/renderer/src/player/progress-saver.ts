export type SaveProgress = (id: string, positionSec: number, durationSec?: number) => void;

export interface ProgressSaver {
  update(id: string, positionSec: number, durationSec?: number): void;
  flush(id: string, positionSec: number, durationSec?: number): void;
}

const valid = (value: number | undefined): number | undefined =>
  value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined;

export function createProgressSaver(save: SaveProgress, intervalMs = 5000, now: () => number = Date.now): ProgressSaver {
  const lastSaved = new Map<string, number>();
  const write = (id: string, positionSec: number, durationSec?: number): void => {
    const position = valid(positionSec);
    if (position === undefined) return;
    lastSaved.set(id, now());
    save(id, position, valid(durationSec));
  };
  return {
    update(id, positionSec, durationSec) {
      const previous = lastSaved.get(id);
      if (previous === undefined) {
        lastSaved.set(id, now());
        return;
      }
      if (now() - previous < intervalMs) return;
      write(id, positionSec, durationSec);
    },
    flush: write,
  };
}
