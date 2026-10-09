import { describe, expect, it } from 'vitest';
import type { Job, JobStatus } from '@shared/types';
import { sortJobs } from '../../src/renderer/src/pages/downloads-logic';

const job = (id: string, status: JobStatus, createdAt: string) => ({ id, status, createdAt }) as Job;

describe('sortJobs', () => {
  it('puts active work first and the newest finished work after it', () => {
    const sorted = sortJobs([
      job('a', 'done', '2026-01-01'),
      job('b', 'downloading', '2026-01-03'),
      job('c', 'queued', '2026-01-02'),
      job('d', 'failed', '2026-01-04'),
      job('e', 'processing', '2026-01-01'),
      job('f', 'done', '2026-01-05'),
      job('g', 'paused', '2026-01-02'),
    ]);
    expect(sorted.map((j) => j.id)).toEqual(['e', 'b', 'c', 'g', 'd', 'f', 'a']);
  });

  it('does not mutate the input', () => {
    const input = [job('a', 'done', '1'), job('b', 'queued', '2')];
    sortJobs(input);
    expect(input.map((j) => j.id)).toEqual(['a', 'b']);
  });
});
