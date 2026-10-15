// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { cropForDigits, estimateSkew, findCandidates, rotatePixels, rotatePixelsBy, type Pixels } from './detect';
import { loadPhoto } from './test/photo';

type RGB = [number, number, number];

/** A dark photo with a cream ticket, and blocks drawn in given colours. */
function scene(
  blocks: { x: number; y: number; w: number; h: number; c: RGB }[],
  width = 600,
  height = 400,
  surface: RGB = [20, 20, 28],
): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  const paint = (x0: number, y0: number, w: number, h: number, [r, g, b]: RGB) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        const i = (y * width + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
  };
  paint(0, 0, width, height, surface);
  paint(100, 80, 400, 240, [245, 238, 222]);
  for (const b of blocks) paint(b.x, b.y, b.w, b.h, b.c);
  return { width, height, data };
}

/** Three "digits" in blue pen, sitting on a long ruled line. */
const DIGITS = [0, 1, 2].map((i) => ({ x: 300 + i * 26, y: 230, w: 14, h: 30, c: [40, 50, 140] as RGB }));
const LINE = { x: 220, y: 262, w: 200, h: 2, c: [50, 50, 60] as RGB };

describe('findCandidates', () => {
  it('finds handwriting on the ticket as one word, and not the ruled line', () => {
    const [top] = findCandidates(scene([...DIGITS, LINE]));
    expect(top).toBeDefined();
    const box = top!.box;
    // The three digits together, at their real place in the photo.
    expect(box.x * 600).toBeCloseTo(300, -1);
    expect((box.x + box.w) * 600).toBeCloseTo(366, -1);
    expect(box.y * 400).toBeCloseTo(230, -1);
    expect(box.h * 400).toBeLessThan(40);
  });

  it('finds digits written onto a slanted line', () => {
    // The line drops 1px every 15px, so no straight row of it is long, and it touches every digit.
    const slant = Array.from({ length: 14 }, (_, i) => ({ x: 220 + i * 15, y: 266 - i, w: 15, h: 2, c: [50, 50, 60] as RGB }));
    const digits = DIGITS.map((d) => ({ ...d, h: 36 - Math.floor((d.x - 220) / 15) }));
    const [top] = findCandidates(scene([...digits, ...slant]));
    expect(top).toBeDefined();
    expect(top!.box.x * 600).toBeCloseTo(300, -1);
    expect((top!.box.x + top!.box.w) * 600).toBeCloseTo(366, -1);
  });

  it('finds a ticket lying on a light desk, and small writing on it', () => {
    const small = [0, 1, 2].map((i) => ({ x: 300 + i * 10, y: 240, w: 6, h: 11, c: [40, 50, 140] as RGB }));
    // A dark keyboard along the top edge, as in a real desk photo.
    const keyboard = { x: 0, y: 0, w: 600, h: 60, c: [25, 25, 30] as RGB };
    const [top] = findCandidates(scene([keyboard, ...small], 600, 400, [190, 188, 182]));
    expect(top).toBeDefined();
    expect(top!.box.x * 600).toBeCloseTo(300, -1);
    expect(top!.box.y * 400).toBeCloseTo(240, -1);
  });

  it('ignores warm orange print', () => {
    const orange = DIGITS.map((d) => ({ ...d, c: [235, 120, 40] as RGB }));
    expect(findCandidates(scene(orange))).toEqual([]);
  });

  it('finds nothing on a blank ticket', () => {
    expect(findCandidates(scene([]))).toEqual([]);
  });
});

describe('cropForDigits', () => {
  it('gives black digits on white, scaled up, with the line underneath removed', () => {
    const photo = scene([...DIGITS, LINE]);
    const crop = cropForDigits(photo, { x: 300 / 600, y: 230 / 400, w: 66 / 600, h: 32 / 400 }, { target: 64 });
    expect(crop.height).toBeGreaterThan(64);
    const black = crop.data.filter((v) => v === 0).length;
    expect(black).toBeGreaterThan(0);
    // No row is inked across most of the crop: the ruled line is gone.
    for (let y = 0; y < crop.height; y++) {
      let n = 0;
      for (let x = 0; x < crop.width; x++) n += crop.data[y * crop.width + x] === 0 ? 1 : 0;
      expect(n).toBeLessThan(crop.width * 0.6);
    }
  });
});

describe('rotation helpers', () => {
  const tiny: Pixels = {
    width: 2,
    height: 1,
    data: new Uint8ClampedArray([1, 1, 1, 255, 2, 2, 2, 255]),
  };

  it('turns quarter turns clockwise', () => {
    const r = rotatePixels(tiny, 90);
    expect([r.width, r.height]).toEqual([1, 2]);
    expect([r.data[0], r.data[4]]).toEqual([1, 2]);
    const back = rotatePixels(rotatePixels(r, 90), 180);
    expect([...back.data]).toEqual([...tiny.data]);
  });

  it('measures how far a ticket is tilted', () => {
    const photo = loadPhoto('ticket-362.jpg');
    const level = estimateSkew(photo);
    expect(Math.abs(level)).toBeLessThan(3);
    // Turning the photo 8° clockwise shows up as ~8° more tilt.
    expect(estimateSkew(rotatePixelsBy(photo, 8)) - level).toBeCloseTo(8, -0.5);
    expect(estimateSkew(rotatePixelsBy(photo, -8)) - level).toBeCloseTo(-8, -0.5);
  });
});
