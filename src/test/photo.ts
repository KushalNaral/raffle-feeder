import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';
import type { Pixels } from '../detect';

/** Decode a JPEG from src/test/photos into pixels. */
export function loadPhoto(name: string): Pixels {
  const file = fileURLToPath(new URL(`./photos/${name}`, import.meta.url));
  const raw = jpeg.decode(readFileSync(file), { useTArray: true, formatAsRGBA: true });
  return { width: raw.width, height: raw.height, data: new Uint8ClampedArray(raw.data.buffer) };
}
