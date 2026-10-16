import type { ErrorCode } from '@shared/types';

export class YtdlpError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly log = '',
  ) {
    super(`yt-dlp error: ${code}`);
    this.name = 'YtdlpError';
  }
}

// Order matters: the first match wins.
const PATTERNS: ReadonlyArray<readonly [RegExp, ErrorCode]> = [
  [/\[spotify\] no match/i, 'NO_MATCH'],
  [/private video|this video is private/i, 'PRIVATE'],
  [/confirm your age|age[- ]restricted|inappropriate for some users/i, 'AGE_RESTRICTED'],
  [/confirm you(?:'|’)?re not a bot|confirm you are not a bot/i, 'BOT_CHECK'],
  [/available in your country|blocked it in your country|geo[- ]?restrict/i, 'GEO_BLOCKED'],
  [/no space left on device|\[errno 28\]|enospc|winerror 112|not enough space on the disk/i, 'DISK_FULL'],
  [
    /video unavailable|has been removed|no longer available|account associated with this video has been terminated|members-only|join this channel to get access|premieres in/i,
    'UNAVAILABLE',
  ],
  [
    /getaddrinfo failed|failed to resolve|name or service not known|temporary failure in name resolution|unable to download webpage|timed out|connection reset|network is unreachable|no route to host|winerror 1006\d|winerror 10051|errno 11001/i,
    'NETWORK',
  ],
];

export function mapError(log: string): ErrorCode {
  const errorLines = log
    .split(/\r?\n/)
    .filter((line) => /^ERROR\b/.test(line.trim()))
    .join('\n');
  const haystack = errorLines.length > 0 ? errorLines : log;
  for (const [pattern, code] of PATTERNS) if (pattern.test(haystack)) return code;
  return 'UNKNOWN';
}

export function errorCodeOf(err: unknown): ErrorCode {
  return err instanceof YtdlpError ? err.code : 'UNKNOWN';
}
