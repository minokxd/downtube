/// <reference types="vite/client" />
import type { DowntubeApi } from '@shared/ipc-contract';

declare global {
  interface Window {
    downtube: DowntubeApi;
  }
}

export {};
