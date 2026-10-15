// Decide which candidate on a ticket is its number. The OCR engine is passed in,
// so the same logic runs on the real Tesseract worker and in tests.
//
// One OCR read of a handwritten number is unreliable (a 3 easily reads as 2), so each
// promising candidate is read several times, at different sizes and in two layout
// modes, and the reads vote, weighted by confidence.

import {
  cropForDigits,
  estimateSkew,
  findCandidates,
  rotatePixels,
  rotatePixelsBy,
  type CropOptions,
  type GrayImage,
  type Pixels,
} from './detect';
import type { Box, Rotation } from './types';

export type Mode = 'line' | 'word';

/** Reads digits from a clean crop: the text and a 0–100 confidence. */
export type Recognize = (crop: GrayImage, mode: Mode) => Promise<{ text: string; confidence: number }>;

export interface NumberRead {
  number: string;
  /** 0–100: how strongly the reads agreed. */
  confidence: number;
  /** Where the number was found, normalized to the (rotated) photo. */
  box: Box;
  /** Clockwise rotation the photo needed for the number to read upright. */
  rotation: Rotation;
}

const MAX_DIGITS = 6;
/** Crop settings the vote draws on; the first is also the quick screen. */
const CROPS: CropOptions[] = [
  { target: 64, margin: 0.15 },
  { target: 48, margin: 0.15 },
  { target: 48, margin: 0.4 },
  { target: 32, margin: 0.4 },
];
const MODES: Mode[] = ['word', 'line'];
/** Summed confidence a winner needs, and its share of all votes. */
const MIN_WEIGHT = 120;
const MIN_SHARE = 0.55;
/** Inside a spot the user marked, a weaker vote is enough. */
const AREA_MIN_WEIGHT = 60;
/** A marked spot read as a whole: it's looser than a found word, so it's scaled up more. */
const AREA_CROPS: CropOptions[] = [
  { target: 128, margin: 0.05 },
  { target: 96, margin: 0.05 },
];
/** Ink this much redder than blue is coloured print, whose votes count for less. */
const RED_TINT = -25;
const RED_FACTOR = 0.3;
/** A vote this strong ends the search. */
const SURE_WEIGHT = 300;

const digits = (s: string) => s.replace(/\D/g, '');
/** Specks and decorations read as a lone digit far more often than numbers do. */
const lengthFactor = (n: string) => (n.length === 1 ? 0.35 : n.length === 2 ? 0.8 : 1);

interface Vote {
  number: string;
  weight: number;
  share: number;
}

async function vote(photo: Pixels, box: Box, recognize: Recognize, crops = CROPS): Promise<Vote | null> {
  const tally = new Map<string, number>();
  let total = 0;
  let first = true;
  for (const opts of crops) {
    const crop = cropForDigits(photo, box, opts);
    for (const mode of MODES) {
      const { text, confidence } = await recognize(crop, mode);
      const n = digits(text);
      // Screen: if the first read finds no digits, this isn't the number.
      if (first && (!n || n.length > MAX_DIGITS)) return null;
      first = false;
      if (!n || n.length > MAX_DIGITS) continue;
      const weight = Math.max(1, confidence) * lengthFactor(n);
      tally.set(n, (tally.get(n) ?? 0) + weight);
      total += weight;
    }
  }
  let best: Vote | null = null;
  for (const [number, weight] of tally)
    if (!best || weight > best.weight) best = { number, weight, share: weight / total };
  return best;
}

type Read = NumberRead & { weight: number };

const toRead = (v: Vote, box: Box, rotation: Rotation): Read => ({
  number: v.number,
  confidence: Math.round(100 * v.share * Math.min(1, v.weight / SURE_WEIGHT)),
  box,
  rotation,
  weight: v.weight,
});

async function readAt(
  photo: Pixels,
  recognize: Recognize,
  rotation: Rotation,
  within?: (box: Box) => boolean,
  minWeight = MIN_WEIGHT,
): Promise<Read | null> {
  let best: Read | null = null;
  for (const c of findCandidates(photo, 10, within)) {
    const read = await vote(photo, c.box, recognize);
    // Red print (dates, serials in the design) reads cleanly but is rarely the written number.
    const v = read && c.tint < RED_TINT ? { ...read, weight: read.weight * RED_FACTOR } : read;
    if (!v || v.weight < minWeight || v.share < MIN_SHARE) continue;
    if (!best || v.weight > best.weight) best = toRead(v, c.box, rotation);
    if (v.weight >= SURE_WEIGHT) break;
  }
  return best;
}

/** Map a box found on a photo turned by `deg` back onto the photo before turning. */
function unturnBox(box: Box, deg: number, width: number, height: number): Box {
  const a = (deg * Math.PI) / 180;
  const dx = (box.x + box.w / 2 - 0.5) * width;
  const dy = (box.y + box.h / 2 - 0.5) * height;
  const cx = 0.5 + (dx * Math.cos(a) + dy * Math.sin(a)) / width;
  const cy = 0.5 + (-dx * Math.sin(a) + dy * Math.cos(a)) / height;
  return { ...box, x: cx - box.w / 2, y: cy - box.h / 2 };
}

/**
 * As shot, then straightened if that wasn't conclusive. `within` and the returned box
 * are in the coordinates of `photo` as given, whichever way it was straightened.
 */
async function readQuarter(
  photo: Pixels,
  recognize: Recognize,
  rotation: Rotation,
  within?: (box: Box) => boolean,
  minWeight = MIN_WEIGHT,
) {
  const plain = await readAt(photo, recognize, rotation, within, minWeight);
  if (plain && plain.weight >= SURE_WEIGHT) return plain;
  const skew = estimateSkew(photo);
  // The outline's angle is only good to about 2°, so try either side of it too.
  const turns = [-skew, -skew - 2, -skew + 2].filter((t) => Math.abs(t) >= 1.5);
  let best = plain;
  for (const turn of turns) {
    const back = (b: Box) => unturnBox(b, turn, photo.width, photo.height);
    const read = await readAt(rotatePixelsBy(photo, turn), recognize, rotation, within && ((b) => within(back(b))), minWeight);
    if (read && (!best || read.weight > best.weight)) best = { ...read, box: back(read.box) };
    if (best && best.weight >= SURE_WEIGHT) break;
  }
  return best;
}

/** Does the middle of `box` fall inside `area`? */
const centredIn = (area: Box) => (box: Box) => {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return cx >= area.x && cx <= area.x + area.w && cy >= area.y && cy <= area.y + area.h;
};

/** Read the number inside a marked spot, which may be drawn loosely around it. */
async function readArea(photo: Pixels, recognize: Recognize, area: Box): Promise<Read | null> {
  const found = await readQuarter(photo, recognize, 0, centredIn(area), AREA_MIN_WEIGHT);
  if (found) return found;
  // Nothing word-like there (the writing may touch the box's edges): read the spot itself.
  const v = await vote(photo, area, recognize, AREA_CROPS);
  if (!v || v.weight < AREA_MIN_WEIGHT / 2 || v.share < MIN_SHARE) return null;
  return toRead(v, area, 0);
}

export interface ReadOptions {
  /** A spot to look in first, normalized to the photo as given. */
  area?: Box;
  /** Only look in `area`, never elsewhere on the photo. */
  onlyArea?: boolean;
}

/** Find and read the ticket number: as shot, straightened, then turned either way or over. */
export async function readTicketNumber(
  photo: Pixels,
  recognize: Recognize,
  { area, onlyArea = false }: ReadOptions = {},
): Promise<NumberRead | null> {
  let best: Read | null = area ? await readArea(photo, recognize, area) : null;
  if (!best && !(area && onlyArea)) {
    best = await readQuarter(photo, recognize, 0);
    for (const rotation of [90, 270, 180] as const) {
      if (best && best.weight >= SURE_WEIGHT) break;
      const read = await readQuarter(rotatePixels(photo, rotation), recognize, rotation);
      if (read && (!best || read.weight > best.weight)) best = read;
    }
  }
  if (!best) return null;
  const { weight: _weight, ...read } = best;
  return read;
}
