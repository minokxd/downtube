import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC, type DowntubeApi, type Unsubscribe } from '@shared/ipc-contract';

function subscribe<T>(channel: string, callback: (payload: T) => void): Unsubscribe {
  const listener = (_event: IpcRendererEvent, payload: T): void => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: DowntubeApi = {
  app: {
    info: () => ipcRenderer.invoke(IPC.appInfo),
    freeSpace: () => ipcRenderer.invoke(IPC.appFreeSpace),
    setTitleBarTheme: (theme) => ipcRenderer.invoke(IPC.setTitleBarTheme, theme),
  },
  engine: {
    status: () => ipcRenderer.invoke(IPC.engineStatus),
    install: (force) => ipcRenderer.invoke(IPC.engineInstall, force),
    update: () => ipcRenderer.invoke(IPC.engineUpdate),
    onProgress: (callback) => subscribe(IPC.engineProgress, callback),
  },
  probe: (url, start) => ipcRenderer.invoke(IPC.probe, url, start),
  jobs: {
    list: () => ipcRenderer.invoke(IPC.jobsList),
    add: (inputs) => ipcRenderer.invoke(IPC.jobsAdd, inputs),
    cancel: (id) => ipcRenderer.invoke(IPC.jobsCancel, id),
    retry: (id) => ipcRenderer.invoke(IPC.jobsRetry, id),
    remove: (id) => ipcRenderer.invoke(IPC.jobsRemove, id),
    clearFinished: () => ipcRenderer.invoke(IPC.jobsClearFinished),
    onChanged: (callback) => subscribe(IPC.jobsChanged, callback),
  },
  library: {
    list: () => ipcRenderer.invoke(IPC.libraryList),
    remove: (id, deleteFiles) => ipcRenderer.invoke(IPC.libraryRemove, id, deleteFiles),
    saveProgress: (id, positionSec, durationSec) => ipcRenderer.invoke(IPC.librarySaveProgress, id, positionSec, durationSec),
    markPlayed: (id) => ipcRenderer.invoke(IPC.libraryMarkPlayed, id),
    showInFolder: (id) => ipcRenderer.invoke(IPC.libraryShowInFolder, id),
    onChanged: (callback) => subscribe(IPC.libraryChanged, callback),
  },
  playlists: {
    create: (title, emoji) => ipcRenderer.invoke(IPC.playlistsCreate, title, emoji),
    update: (id, patch) => ipcRenderer.invoke(IPC.playlistsUpdate, id, patch),
    remove: (id) => ipcRenderer.invoke(IPC.playlistsDelete, id),
    addItems: (id, itemIds) => ipcRenderer.invoke(IPC.playlistsAddItems, id, itemIds),
    removeItems: (id, itemIds) => ipcRenderer.invoke(IPC.playlistsRemoveItems, id, itemIds),
    moveItems: (id, itemIds, beforeId) => ipcRenderer.invoke(IPC.playlistsMoveItems, id, itemIds, beforeId),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    update: (patch) => ipcRenderer.invoke(IPC.settingsUpdate, patch),
    chooseDownloadDir: () => ipcRenderer.invoke(IPC.settingsChooseDir),
    onChanged: (callback) => subscribe(IPC.settingsChanged, callback),
  },
  clipboard: {
    onYoutubeLink: (callback) => subscribe(IPC.clipboardLink, callback),
  },
};

contextBridge.exposeInMainWorld('downtube', api);
