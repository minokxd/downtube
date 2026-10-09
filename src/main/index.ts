import { promises as fs } from 'node:fs';
import { BrowserWindow, app, clipboard, dialog, nativeTheme, net, protocol } from 'electron';
import { IPC } from '@shared/ipc-contract';
import { ClipboardWatcher } from './clipboard';
import { registerIpc } from './ipc';
import { MEDIA_SCHEME, handleMediaRequest } from './media-protocol';
import { createServices, type Services } from './services';
import { scheduleAutoUpdate } from './updater';
import { createMainWindow } from './window';

// Lets tests and portable setups use a separate profile.
if (process.env.DOWNTUBE_USER_DATA) app.setPath('userData', process.env.DOWNTUBE_USER_DATA);

protocol.registerSchemesAsPrivileged([
  { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } },
]);

let mainWindow: BrowserWindow | null = null;
let services: Services | null = null;
let quitting = false;

const fileExists = (path: string): Promise<boolean> =>
  fs.access(path).then(
    () => true,
    () => false,
  );

async function bootstrap(): Promise<void> {
  app.setAppUserModelId('com.minokxd.downtube');
  const s = await createServices({
    userData: app.getPath('userData'),
    videosDir: app.getPath('videos'),
    fetchImpl: (url, init) => net.fetch(url, init),
  });
  services = s;
  protocol.handle(MEDIA_SCHEME, (request) => handleMediaRequest(request, s.library));
  registerIpc(s, () => mainWindow);

  const settings = s.settings.get();
  const theme = settings.theme === 'system' ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light') : settings.theme;
  mainWindow = createMainWindow(theme);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const watcher = new ClipboardWatcher(
    () => clipboard.readText(),
    (url) => mainWindow?.webContents.send(IPC.clipboardLink, url),
  );
  if (settings.clipboardWatch) watcher.start();
  s.settings.onChange((next) => (next.clipboardWatch ? watcher.start() : watcher.stop()));

  void s.library.refreshMissing(fileExists);
  scheduleAutoUpdate(s);
  s.queue.pump();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app
    .whenReady()
    .then(bootstrap)
    .catch((err: unknown) => {
      dialog.showErrorBox('Downtube', err instanceof Error ? (err.stack ?? err.message) : String(err));
      app.quit();
    });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', (event) => {
    if (quitting || !services) return;
    event.preventDefault();
    quitting = true;
    void services.shutdown().finally(() => app.quit());
  });
}
