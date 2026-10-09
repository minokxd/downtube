import type { Job, JobStatus } from '@shared/types';

const RANK: Record<JobStatus, number> = {
  downloading: 0,
  processing: 0,
  queued: 1,
  paused: 2,
  failed: 3,
  done: 4,
  canceled: 4,
};

export function sortJobs(jobs: readonly Job[]): Job[] {
  return [...jobs].sort((a, b) => {
    const byRank = RANK[a.status] - RANK[b.status];
    if (byRank !== 0) return byRank;
    // Pending work runs in the order it was added; finished work shows the newest first.
    return RANK[a.status] >= 3 ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt);
  });
}
