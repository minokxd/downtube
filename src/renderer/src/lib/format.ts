export function formatDuration(totalSec: number | undefined): string {
  if (totalSec === undefined || !Number.isFinite(totalSec) || totalSec < 0) return '--:--';
  const s = Math.floor(totalSec);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export function formatBytes(bytes: number | undefined, locale = 'tr-TR'): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return '—';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: unit === 0 ? 0 : 1 }).format(value)} ${UNITS[unit]}`;
}

export function formatSpeed(bytesPerSecond: number | undefined, locale = 'tr-TR'): string {
  return bytesPerSecond === undefined ? '' : `${formatBytes(bytesPerSecond, locale)}/s`;
}

export function formatPercent(percent: number, locale = 'tr-TR'): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(percent / 100);
}
