import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

const SUMS_LINE = /^([a-fA-F0-9]{64})\s+\*?(.+)$/;
const HEX64 = /[a-fA-F0-9]{64}/g;

export function parseChecksum(text: string, fileName: string): string | undefined {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  let sawSumsLine = false;
  for (const line of lines) {
    const match = SUMS_LINE.exec(line);
    if (!match) continue;
    sawSumsLine = true;
    if (match[2]?.trim() === fileName) return match[1]?.toLowerCase();
  }
  // PowerShell Get-FileHash output, as published by Deno.
  const hashLine = lines.find((line) => /^Hash\s*:/i.test(line));
  const fromHashLine = hashLine?.match(HEX64)?.[0];
  if (fromHashLine) return fromHashLine.toLowerCase();
  if (sawSumsLine) return undefined;
  const all = text.match(HEX64);
  return all && all.length === 1 ? all[0]?.toLowerCase() : undefined;
}

export function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(path)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}
