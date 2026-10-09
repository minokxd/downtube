import type { UpdateResult } from '@shared/types';
import type { Services } from './services';

const DAY_MS = 24 * 60 * 60 * 1000;
const BUSY_RETRY_MS = 60_000;

export async function runYtdlpUpdate(services: Services): Promise<UpdateResult> {
  // A running yt-dlp.exe cannot be replaced, so updates wait for an idle queue.
  if (!services.queue.isIdle() || services.isUpdating()) return { ok: false, message: 'busy' };
  services.setUpdating(true);
  try {
    const result = await services.engine.updateYtdlp();
    await services.settings.update({ lastYtdlpUpdateCheck: new Date().toISOString() });
    await services.engine.status();
    return result;
  } finally {
    services.setUpdating(false);
    services.queue.pump();
  }
}

export function scheduleAutoUpdate(services: Services, delayMs = 15_000): void {
  const last = services.settings.get().lastYtdlpUpdateCheck;
  if (last && Date.now() - Date.parse(last) < DAY_MS) return;
  const attempt = (): void => {
    if (!services.engine.paths()) return;
    if (!services.queue.isIdle()) {
      setTimeout(attempt, BUSY_RETRY_MS);
      return;
    }
    void runYtdlpUpdate(services).catch(() => undefined);
  };
  setTimeout(attempt, delayMs);
}
