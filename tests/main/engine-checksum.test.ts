import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseChecksum, sha256File } from '../../src/main/engine/checksum';

const A = '1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6';
const B = '66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a';

describe('parseChecksum', () => {
  it('reads sha256sum style lists by file name', () => {
    const text = `${A}  yt-dlp\n${B}  yt-dlp.exe\n${A}  yt-dlp_x86.exe\n`;
    expect(parseChecksum(text, 'yt-dlp.exe')).toBe(B);
    expect(parseChecksum(text, 'missing.exe')).toBeUndefined();
  });

  it('accepts binary markers', () => {
    expect(parseChecksum(`${B} *ffmpeg.zip`, 'ffmpeg.zip')).toBe(B);
  });

  it('reads PowerShell Get-FileHash output (Deno)', () => {
    const text = `\r\nAlgorithm : SHA256\r\nHash      : ${B.toUpperCase()}\r\nPath      : C:\\a\\deno.zip\r\n`;
    expect(parseChecksum(text, 'deno-x86_64-pc-windows-msvc.zip')).toBe(B);
  });

  it('reads a bare hash file', () => {
    expect(parseChecksum(`${A}\n`, 'anything.zip')).toBe(A);
  });
});

describe('sha256File', () => {
  it('hashes a file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'downtube-sha-'));
    try {
      await writeFile(join(dir, 'f.txt'), 'abc');
      expect(await sha256File(join(dir, 'f.txt'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
