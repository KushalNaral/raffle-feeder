// @vitest-environment node
// End to end with the real Tesseract engine, on a real photo and a printed ticket.
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWorker, type Worker } from 'tesseract.js';
import { findTicket, rotatePixels, rotatePixelsBy, type Pixels } from './detect';
import { recognizerFor } from './ocr';
import { readTicketNumber, type Recognize } from './readNumber';
import { fromTicket, toTicket } from './spot';
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

  it('reads it from a photo taken upside down', async () => {
    const read = await readTicketNumber(rotatePixels(ticket, 180), recognize);
    expect(read?.number).toBe('362');
    expect(read?.rotation).toBe(180);
  });

  it('reads a small ticket lying on a light desk, written on a slanted line', async () => {
    const read = await readTicketNumber(loadPhoto('ticket-363-desk.jpg'), recognize);
    expect(read?.number).toBe('363');
    expect(read?.rotation).toBe(0);
    // Right of the printed label, in the lower part of the ticket.
    expect(read?.box.x).toBeGreaterThan(0.5);
    expect(read?.box.y).toBeGreaterThan(0.55);
    expect(read?.box.y).toBeLessThan(0.62);
  });

  it('reads it on the desk photo tilted the other way', async () => {
    expect((await readTicketNumber(rotatePixelsBy(loadPhoto('ticket-363-desk.jpg'), 5), recognize))?.number).toBe('363');
  });

  it('carries a spot marked on one ticket over to another photographed differently', async () => {
    // Marked loosely around the number on the 362 photo, where the ticket fills the frame...
    const desk = loadPhoto('ticket-363-desk.jpg');
    const marked = { x: 0.43, y: 0.66, w: 0.13, h: 0.054 };
    expect((await readTicketNumber(ticket, recognize, { area: marked, onlyArea: true }))?.number).toBe('362');
    const spot = toTicket(marked, findTicket(ticket));
    // ...then looked for on the small ticket on the desk, and nowhere else.
    const read = await readTicketNumber(desk, recognize, { area: fromTicket(spot, findTicket(desk)), onlyArea: true });
    expect(read?.number).toBe('363');
  });

  it('reads nothing from a marked spot with no number in it', async () => {
    const label = { x: 0.41, y: 0.58, w: 0.08, h: 0.025 };
    expect(await readTicketNumber(loadPhoto('ticket-363-desk.jpg'), recognize, { area: label, onlyArea: true })).toBeNull();
  });

  it('reads a printed number', async () => {
    expect((await readTicketNumber(loadPhoto('printed-0457.jpg'), recognize))?.number).toBe('0457');
  });

  it('gives up rather than guessing when there is no ticket', async () => {
    expect(await readTicketNumber(noise(400, 300), recognize)).toBeNull();
  });
});
