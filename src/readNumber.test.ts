// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { readTicketNumber, type Recognize } from './readNumber';
import * as detect from './detect';
import type { Box } from './types';

const photo: detect.Pixels = { width: 10, height: 10, data: new Uint8ClampedArray(400) };
const box = (x: number): Box => ({ x, y: 0.5, w: 0.1, h: 0.05 });

/** Two candidate words; OCR answers per candidate from a script. */
function setup(script: Record<number, { text: string; confidence: number }[]>, tints: [number, number] = [0, 0]) {
  const candidates = [
    { box: box(0.1), score: 2, tint: tints[0] },
    { box: box(0.6), score: 1, tint: tints[1] },
  ];
  vi.spyOn(detect, 'findCandidates').mockImplementation((_p, _limit, within) =>
    candidates.filter((c) => !within || within(c.box)),
  );
  vi.spyOn(detect, 'estimateSkew').mockReturnValue(0);
  vi.spyOn(detect, 'cropForDigits').mockImplementation((_p, b) => ({ width: 1, height: 1, data: new Uint8ClampedArray([b.x * 10]) }));
  const calls = new Map<number, number>();
  const recognize = vi.fn<Recognize>(async (crop) => {
    const which = crop.data[0] === 1 ? 0 : 1;
    const n = calls.get(which) ?? 0;
    calls.set(which, n + 1);
    // Each attempt (orientation, tilt) replays the same answers.
    const answers = script[which] ?? [];
    return answers[n % (answers.length || 1)] ?? { text: '', confidence: 0 };
  });
  return recognize;
}

const r = (text: string, confidence: number) => ({ text, confidence });

describe('readTicketNumber voting', () => {
  it('takes the reading most reads agree on, weighted by confidence', async () => {
    const recognize = setup({
      0: [r('', 0)],
      1: [r('362', 70), r('262', 80), r('362', 75), r('362', 60), r('262', 30), r('362', 65), r('362', 50), r('362', 70)],
    });
    const read = await readTicketNumber(photo, recognize);
    expect(read).toMatchObject({ number: '362', rotation: 0, box: box(0.6) });
  });

  it('screens out a candidate whose first read has no digits', async () => {
    const recognize = setup({ 0: [r('', 0)], 1: [r('', 0)] });
    expect(await readTicketNumber(photo, recognize)).toBeNull();
    // One quick read per candidate, for each attempt: as shot and nudged ±2°, in 4 orientations.
    expect(recognize.mock.calls.length).toBe(2 * 3 * 4);
  });

  it('prefers a multi-digit number over a confidently read speck', async () => {
    const recognize = setup({ 0: [r('4', 95)], 1: [r('58', 70)] });
    expect((await readTicketNumber(photo, recognize))?.number).toBe('58');
  });

  it('returns nothing when the reads disagree too much', async () => {
    const recognize = setup({
      0: [r('', 0)],
      1: [r('11', 40), r('17', 40), r('71', 40), r('77', 40), r('14', 40), r('41', 40), r('44', 40), r('47', 40)],
    });
    expect(await readTicketNumber(photo, recognize)).toBeNull();
  });

  it('ignores reads too long to be a ticket number', async () => {
    const recognize = setup({ 0: [r('12345678', 99)], 1: [r('', 0)] });
    expect(await readTicketNumber(photo, recognize)).toBeNull();
  });

  it('stops looking once a read is certain', async () => {
    const recognize = setup({ 0: [r('808', 95)], 1: [r('999', 95)] });
    const read = await readTicketNumber(photo, recognize);
    expect(read?.number).toBe('808');
    expect(read?.confidence).toBeGreaterThan(90);
    // Only the first candidate, upright, was ever read.
    expect(recognize.mock.calls.length).toBe(8);
  });

  it('looks in a marked area first, and reads it there with a weaker vote', async () => {
    const recognize = setup({
      0: [r('11', 95)],
      1: [r('47', 30), r('47', 30), r('', 0)],
    });
    const read = await readTicketNumber(photo, recognize, { area: { x: 0.5, y: 0.3, w: 0.3, h: 0.4 } });
    // Candidate 0 reads more surely, but only candidate 1 is in the area.
    expect(read).toMatchObject({ number: '47', box: box(0.6) });
  });

  it('falls back to the whole photo when the area has nothing', async () => {
    const recognize = setup({ 0: [r('11', 95)], 1: [r('', 0)] });
    const read = await readTicketNumber(photo, recognize, { area: { x: 0.5, y: 0.3, w: 0.3, h: 0.4 } });
    expect(read?.number).toBe('11');
  });

  it('stays in the area when told to', async () => {
    const recognize = setup({ 0: [r('11', 95)], 1: [r('', 0)] });
    const area = { x: 0.5, y: 0.3, w: 0.3, h: 0.4 };
    expect(await readTicketNumber(photo, recognize, { area, onlyArea: true })).toBeNull();
  });

  it('reads the area itself when no word is found inside it', async () => {
    const recognize = setup({ 0: [r('11', 95)], 1: [r('', 0)] });
    const area = { x: 0.9, y: 0.3, w: 0.1, h: 0.4 };
    // The crop of the area itself is neither candidate; script it by its first pixel.
    recognize.mockImplementation(async (crop) => (crop.data[0] === 9 ? r('512', 80) : r('', 0)));
    const read = await readTicketNumber(photo, recognize, { area, onlyArea: true });
    expect(read).toMatchObject({ number: '512', box: area });
  });

  it('prefers pen over red print that reads more cleanly', async () => {
    const recognize = setup({ 0: [r('30', 95)], 1: [r('363', 60)] }, [-45, 3]);
    expect((await readTicketNumber(photo, recognize))?.number).toBe('363');
  });
});
