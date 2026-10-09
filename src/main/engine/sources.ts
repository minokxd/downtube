import type { EngineComponentId } from '@shared/types';

export interface ComponentSource {
  id: EngineComponentId;
  url: string;
  checksumUrl: string;
  checksumName: string;
  archive: boolean;
  /** File names placed into the target folder (found anywhere inside an archive). */
  files: string[];
}

export const DEFAULT_SOURCES: Record<EngineComponentId, ComponentSource> = {
  ytdlp: {
    id: 'ytdlp',
    url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
    checksumUrl: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS',
    checksumName: 'yt-dlp.exe',
    archive: false,
    files: ['yt-dlp.exe'],
  },
  deno: {
    id: 'deno',
    url: 'https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip',
    checksumUrl: 'https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip.sha256sum',
    checksumName: 'deno-x86_64-pc-windows-msvc.zip',
    archive: true,
    files: ['deno.exe'],
  },
  ffmpeg: {
    id: 'ffmpeg',
    url: 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    checksumUrl: 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/checksums.sha256',
    checksumName: 'ffmpeg-master-latest-win64-gpl.zip',
    archive: true,
    files: ['ffmpeg.exe', 'ffprobe.exe'],
  },
};
