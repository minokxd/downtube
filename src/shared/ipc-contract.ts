import type {
  AddJobsResult,
  EngineInstallProgress,
  EngineStatus,
  Job,
  LibrarySnapshot,
  NewJobInput,
  ProbeResponse,
  Settings,
  UpdateResult,
} from './types';

export const IPC = {
  appInfo: 'app:info',
  appFreeSpace: 'app:free-space',
  setTitleBarTheme: 'app:set-titlebar-theme',
  engineStatus: 'engine:status',
  engineInstall: 'engine:install',
  engineUpdate: 'engine:update',
  engineProgress: 'engine:progress',
  probe: 'ytdlp:probe',
  jobsList: 'jobs:list',
  jobsAdd: 'jobs:add',
  jobsCancel: 'jobs:cancel',
  jobsRetry: 'jobs:retry',
  jobsRemove: 'jobs:remove',
  jobsClearFinished: 'jobs:clear-finished',
  jobsChanged: 'jobs:changed',
  libraryList: 'library:list',
  libraryRemove: 'library:remove',
  librarySaveProgress: 'library:save-progress',
  libraryMarkPlayed: 'library:mark-played',
  libraryShowInFolder: 'library:show-in-folder',
  libraryChanged: 'library:changed',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsChooseDir: 'settings:choose-dir',
  settingsChanged: 'settings:changed',
  clipboardLink: 'clipboard:youtube-link',
} as const;

export type Unsubscribe = () => void;

// What the renderer may change: the download folder and the update-check timestamp are main-process only.
export type SettingsPatch = Partial<Omit<Settings, 'downloadDir' | 'lastYtdlpUpdateCheck'>>;

export interface DowntubeApi {
  app: {
    info(): Promise<{ version: string; libraryRecovered: 'none' | 'backup' | 'reset' }>;
    /** Free bytes on the download folder's drive, or null when it cannot be read. */
    freeSpace(): Promise<number | null>;
    setTitleBarTheme(theme: 'dark' | 'light'): Promise<void>;
  };
  engine: {
    status(): Promise<EngineStatus>;
    install(force?: boolean): Promise<EngineStatus>;
    update(): Promise<UpdateResult>;
    onProgress(callback: (progress: EngineInstallProgress) => void): Unsubscribe;
  };
  probe(url: string, start?: number): Promise<ProbeResponse>;
  jobs: {
    list(): Promise<Job[]>;
    add(inputs: NewJobInput[]): Promise<AddJobsResult>;
    cancel(id: string): Promise<void>;
    retry(id: string): Promise<void>;
    remove(id: string): Promise<void>;
    clearFinished(): Promise<void>;
    onChanged(callback: (jobs: Job[]) => void): Unsubscribe;
  };
  library: {
    list(): Promise<LibrarySnapshot>;
    remove(id: string, deleteFiles: boolean): Promise<void>;
    saveProgress(id: string, positionSec: number, durationSec?: number): Promise<void>;
    markPlayed(id: string): Promise<void>;
    showInFolder(id: string): Promise<void>;
    onChanged(callback: (snapshot: LibrarySnapshot) => void): Unsubscribe;
  };
  settings: {
    get(): Promise<Settings>;
    // The download folder is only set through chooseDownloadDir; the UI never sends file paths.
    update(patch: SettingsPatch): Promise<Settings>;
    chooseDownloadDir(): Promise<string | null>;
    onChanged(callback: (settings: Settings) => void): Unsubscribe;
  };
  clipboard: {
    onYoutubeLink(callback: (url: string) => void): Unsubscribe;
  };
}
