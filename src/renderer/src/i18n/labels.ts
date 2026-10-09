import type { ErrorCode, InstallPhase, JobStage, JobStatus, Quality } from '@shared/types';
import type { MessageKey } from './tr';

export const QUALITY_LABEL: Record<Quality, MessageKey> = {
  best: 'quality.best',
  '1080': 'quality.1080',
  '720': 'quality.720',
  '480': 'quality.480',
};

export const ERROR_LABEL: Record<ErrorCode, MessageKey> = {
  INVALID_URL: 'error.INVALID_URL',
  PRIVATE: 'error.PRIVATE',
  AGE_RESTRICTED: 'error.AGE_RESTRICTED',
  UNAVAILABLE: 'error.UNAVAILABLE',
  GEO_BLOCKED: 'error.GEO_BLOCKED',
  BOT_CHECK: 'error.BOT_CHECK',
  NETWORK: 'error.NETWORK',
  DISK_FULL: 'error.DISK_FULL',
  ENGINE_MISSING: 'error.ENGINE_MISSING',
  UNKNOWN: 'error.UNKNOWN',
};

export const STATUS_LABEL: Record<JobStatus, MessageKey> = {
  queued: 'downloads.status.queued',
  downloading: 'downloads.status.downloading',
  processing: 'downloads.status.processing',
  paused: 'downloads.status.paused',
  done: 'downloads.status.done',
  failed: 'downloads.status.failed',
  canceled: 'downloads.status.canceled',
};

export const STAGE_LABEL: Record<JobStage, MessageKey> = {
  download: 'downloads.stage.download',
  merge: 'downloads.stage.merge',
  convert: 'downloads.stage.convert',
  thumbnail: 'downloads.stage.thumbnail',
  subtitles: 'downloads.stage.subtitles',
};

export const PHASE_LABEL: Record<InstallPhase, MessageKey> = {
  download: 'setup.phase.download',
  verify: 'setup.phase.verify',
  extract: 'setup.phase.extract',
  done: 'setup.phase.done',
  error: 'setup.phase.error',
};
