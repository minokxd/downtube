import { create } from 'zustand';
import type { Job } from '@shared/types';

interface JobsState {
  jobs: Job[];
  load: () => Promise<void>;
  apply: (jobs: Job[]) => void;
}

export const useJobs = create<JobsState>()((set) => ({
  jobs: [],
  load: async () => set({ jobs: await window.downtube.jobs.list() }),
  apply: (jobs) => set({ jobs }),
}));

export const isActiveJob = (job: Job): boolean =>
  job.status === 'queued' || job.status === 'downloading' || job.status === 'processing';
