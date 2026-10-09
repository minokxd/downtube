// Renders resources/icon.svg to the 512 px PNG used for the window and the installer.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const svgPath = fileURLToPath(new URL('../resources/icon.svg', import.meta.url));
const pngPath = fileURLToPath(new URL('../resources/icon.png', import.meta.url));

const svg = await readFile(svgPath);
await sharp(svg, { density: 384 }).resize(512, 512).png().toFile(pngPath);
console.log(`wrote ${pngPath}`);
