import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron';
import { IPC } from '@shared/ipc-contract';
import type { EngineStatus, ProbeResponse } from '@shared/types';
import { freeBytes } from './disk';
import {
  IpcValidationError,
  assertBoolean,
  assertId,
  assertIdList,
  assertJobInputs,
  assertOptionalDuration,
  assertOptionalId,
  assertPlaylistEmoji,
  assertPlaylistPatch,
  assertPlaylistTitle,
  assertPosition,
  assertSettingsPatch,
  assertStart,
  assertTheme,
  assertYoutubeUrl,
} from './ipc-validate';
import type { Services } from './services';
import { runYtdlpUpdate } from './updater';
import { applyTitleBarTheme } from './window';
import { YtdlpError } from './ytdlp/errors';

export function registerIpc(services: Services, getWindow: () => BrowserWindow | null): void {
  const send = (channel: string, payload: unknown): void => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };
  let installing: Promise<EngineStatus> | null = null;

  ipcMain.handle(IPC.appInfo, () => ({ version: app.getVersion(), libraryRecovered: services.library.recovered }));
  ipcMain.handle(IPC.appFreeSpace, () => freeBytes(services.settings.get().downloadDir));
  ipcMain.handle(IPC.setTitleBarTheme, (_event, theme: unknown) => applyTitleBarTheme(getWindow(), assertTheme(theme)));

  ipcMain.handle(IPC.engineStatus, () => services.engine.status());
  ipcMain.handle(IPC.engineInstall, (_event, force: unknown) => {
    // Joining an install that is already running is always fine.
    if (installing) return installing;
    // Replacing a component can hit a running executable, so wait for an idle queue and no
    // yt-dlp update. Marking the service as updating for the whole install stops the queue from
    // starting downloads and makes runYtdlpUpdate answer 'busy' until the install finishes.
    if (!services.queue.isIdle() || services.isUpdating()) throw new Error('busy');
    services.setUpdating(true);
    installing = services.engine.install((progress) => send(IPC.engineProgress, progress), force === true).finally(() => {
      installing = null;
      services.setUpdating(false);
      services.queue.pump();
    });
    return installing;
  });
  ipcMain.handle(IPC.engineUpdate, () => runYtdlpUpdate(services));

  ipcMain.handle(IPC.probe, async (_event, url: unknown, start: unknown): Promise<ProbeResponse> => {
    try {
      return { ok: true, result: await services.ytdlp.probe(assertYoutubeUrl(url), assertStart(start)) };
    } catch (err) {
      if (err instanceof YtdlpError) return { ok: false, code: err.code, log: err.log };
      if (err instanceof IpcValidationError) return { ok: false, code: 'INVALID_URL' };
      return { ok: false, code: 'UNKNOWN', log: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.jobsList, () => services.queue.list());
  ipcMain.handle(IPC.jobsAdd, (_event, inputs: unknown) => services.queue.add(assertJobInputs(inputs)));
  ipcMain.handle(IPC.jobsCancel, (_event, id: unknown) => services.queue.cancel(assertId(id)));
  ipcMain.handle(IPC.jobsRetry, (_event, id: unknown) => services.queue.retry(assertId(id)));
  ipcMain.handle(IPC.jobsRemove, (_event, id: unknown) => services.queue.remove(assertId(id)));
  ipcMain.handle(IPC.jobsClearFinished, () => services.queue.clearFinished());

  ipcMain.handle(IPC.libraryList, () => services.library.snapshot());
  // A failed trash move rejects here on purpose: the renderer must be able to report it.
  ipcMain.handle(IPC.libraryRemove, (_event, id: unknown, deleteFiles: unknown) =>
    services.library.remove(assertId(id), assertBoolean(deleteFiles), (path) => shell.trashItem(path)),
  );
  ipcMain.handle(IPC.librarySaveProgress, (_event, id: unknown, position: unknown, duration: unknown) =>
    services.library.saveProgress(assertId(id), assertPosition(position), assertOptionalDuration(duration)),
  );
  ipcMain.handle(IPC.libraryMarkPlayed, (_event, id: unknown) => services.library.markPlayed(assertId(id)));
  ipcMain.handle(IPC.libraryShowInFolder, (_event, id: unknown) => {
    const item = services.library.get(assertId(id));
    if (item) shell.showItemInFolder(item.filePath);
  });

  ipcMain.handle(IPC.playlistsCreate, (_event, title: unknown, emoji: unknown) =>
    services.library.createPlaylist(assertPlaylistTitle(title), assertPlaylistEmoji(emoji)),
  );
  ipcMain.handle(IPC.playlistsUpdate, (_event, id: unknown, patch: unknown) =>
    services.library.updatePlaylist(assertId(id), assertPlaylistPatch(patch)),
  );
  ipcMain.handle(IPC.playlistsDelete, (_event, id: unknown) => services.library.deletePlaylist(assertId(id)));
  ipcMain.handle(IPC.playlistsAddItems, (_event, id: unknown, itemIds: unknown) =>
    services.library.addToPlaylist(assertId(id), assertIdList(itemIds)),
  );
  ipcMain.handle(IPC.playlistsRemoveItems, (_event, id: unknown, itemIds: unknown) =>
    services.library.removeFromPlaylist(assertId(id), assertIdList(itemIds)),
  );
  ipcMain.handle(IPC.playlistsMoveItems, (_event, id: unknown, itemIds: unknown, beforeId: unknown) =>
    services.library.movePlaylistItems(assertId(id), assertIdList(itemIds), assertOptionalId(beforeId)),
  );

  ipcMain.handle(IPC.settingsGet, () => services.settings.get());
  ipcMain.handle(IPC.settingsUpdate, (_event, patch: unknown) => services.settings.update(assertSettingsPatch(patch)));
  ipcMain.handle(IPC.settingsChooseDir, async () => {
    const win = getWindow();
    const options: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: services.settings.get().downloadDir,
    };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    const chosen = result.canceled ? undefined : result.filePaths[0];
    if (!chosen) return null;
    await services.settings.update({ downloadDir: chosen });
    return chosen;
  });

  services.queue.onChange((jobs) => send(IPC.jobsChanged, jobs));
  services.library.onChange(() => send(IPC.libraryChanged, services.library.snapshot()));
  services.settings.onChange((settings) => send(IPC.settingsChanged, settings));
}
