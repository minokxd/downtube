export const parseYtdlpVersion = (output: string): string | undefined => output.trim().split(/\r?\n/)[0]?.trim() || undefined;

export const parseDenoVersion = (output: string): string | undefined => /deno\s+(\d+\.\d+\.\d+)/i.exec(output)?.[1];

export const parseFfmpegVersion = (output: string): string | undefined => /ffmpeg version\s+(\S+)/i.exec(output)?.[1];
