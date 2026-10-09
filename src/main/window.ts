import { join } from 'node:path';
import { BrowserWindow, shell } from 'electron';

export const TITLEBAR_HEIGHT = 48;

const COLORS = {
  dark: { color: '#111113', symbolColor: '#ececf1' },
  light: { color: '#f5f0e8', symbolColor: '#2a2420' },
} as const;

export function createMainWindow(theme: 'dark' | 'light'): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Downtube',
    backgroundColor: COLORS[theme].color,
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...COLORS[theme], height: TITLEBAR_HEIGHT },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL;
    if (!devUrl || !url.startsWith(devUrl)) event.preventDefault();
  });
  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void win.loadFile(join(__dirname, '../renderer/index.html'));
  return win;
}

export function applyTitleBarTheme(win: BrowserWindow | null, theme: 'dark' | 'light'): void {
  if (!win || win.isDestroyed()) return;
  win.setBackgroundColor(COLORS[theme].color);
  if (process.platform === 'win32') win.setTitleBarOverlay({ ...COLORS[theme], height: TITLEBAR_HEIGHT });
}
