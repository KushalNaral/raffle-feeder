// @vitest-environment node
// End to end with the real Tesseract engine, on a real photo and a printed ticket.
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWorker, type Worker } from 'tesseract.js';
import { rotatePixels, rotatePixelsBy, type Pixels } from './detect';
import { recognizerFor } from './ocr';
import { readTicketNumber, type Recognize } from './readNumber';
import { loadPhoto } from './test/photo';

let worker: Worker;
let recognize: Recognize;

beforeAll(async () => {
  worker = await createWorker('eng', 1, {
    langPath: fileURLToPath(new URL('../node_modules/@tesseract.js-data/eng/4.0.0_best_int', import.meta.url)),
    cachePath: tmpdir(),
    gzip: true,
  });
  await worker.setParameters({ tessedit_char_whitelist: '0123456789' });
  recognize = recognizerFor(worker, (bytes) => Buffer.from(bytes));
}, 60_000);

afterAll(() => worker?.terminate());

/** Shift colours as a warm indoor light would. */
const warm = (p: Pixels): Pixels => {
  const data = new Uint8ClampedArray(p.data);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (data[i] ?? 0) * 1.15;
    data[i + 2] = (data[i + 2] ?? 0) * 0.8;
  }
  return { ...p, data };
};

/** Seeded noise: a photo with no ticket in it. */
const noise = (width: number, height: number): Pixels => {
  let seed = 7;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = i % 4 === 3 ? 255 : 60 + (seed % 80);
  }
  return { width, height, data };
};

describe('readTicketNumber with real OCR', { timeout: 60_000 }, () => {
  const ticket = loadPhoto('ticket-362.jpg');

  it('reads a handwritten number with no marked spot', async () => {
    const read = await readTicketNumber(ticket, recognize);
    expect(read?.number).toBe('362');
    expect(read?.rotation).toBe(0);
    // The box lands on the number, right of the printed label, low on the ticket.
    expect(read?.box.x).toBeGreaterThan(0.4);
    expect(read?.box.y).toBeGreaterThan(0.6);
  });

  it('reads it from a photo taken sideways, and says which way to turn it', async () => {
    const read = await readTicketNumber(rotatePixels(ticket, 90), recognize);
    expect(read?.number).toBe('362');
    expect(read?.rotation).toBe(270);
  });

  it('reads it from a tilted photo', async () => {
    const read = await readTicketNumber(rotatePixelsBy(ticket, 6), recognize);
    expect(read?.number).toBe('362');
  });

  it('reads it under warm light', async () => {
    expect((await readTicketNumber(warm(ticket), recognize))?.number).toBe('362');
  });

  it('reads a printed number', async () => {
    expect((await readTicketNumber(loadPhoto('printed-0457.jpg'), recognize))?.number).toBe('0457');
  });

  it('gives up rather than guessing when there is no ticket', async () => {
    expect(await readTicketNumber(noise(400, 300), recognize)).toBeNull();
  });
});
