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

async function vote(photo: Pixels, box: Box, recognize: Recognize): Promise<Vote | null> {
  const tally = new Map<string, number>();
  let total = 0;
  let first = true;
  for (const opts of CROPS) {
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

async function readAt(photo: Pixels, recognize: Recognize, rotation: Rotation): Promise<(NumberRead & { weight: number }) | null> {
  let best: (NumberRead & { weight: number }) | null = null;
  for (const c of findCandidates(photo, 10)) {
    const v = await vote(photo, c.box, recognize);
    if (!v || v.weight < MIN_WEIGHT || v.share < MIN_SHARE) continue;
    if (!best || v.weight > best.weight) {
      const confidence = Math.round(100 * v.share * Math.min(1, v.weight / SURE_WEIGHT));
      best = { number: v.number, confidence, box: c.box, rotation, weight: v.weight };
    }
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

/** As shot, then straightened if that wasn't conclusive. */
async function readQuarter(photo: Pixels, recognize: Recognize, rotation: Rotation) {
  const plain = await readAt(photo, recognize, rotation);
  if (plain && plain.weight >= SURE_WEIGHT) return plain;
  const skew = estimateSkew(photo);
  // The outline's angle is only good to about 2°, so try either side of it too.
  const turns = [-skew, -skew - 2, -skew + 2].filter((t) => Math.abs(t) >= 1.5);
  let best = plain;
  for (const turn of turns) {
    const read = await readAt(rotatePixelsBy(photo, turn), recognize, rotation);
    if (read && (!best || read.weight > best.weight))
      best = { ...read, box: unturnBox(read.box, turn, photo.width, photo.height) };
    if (best && best.weight >= SURE_WEIGHT) break;
  }
  return best;
}

/** Find and read the ticket number: as shot, straightened, then turned either way. */
export async function readTicketNumber(photo: Pixels, recognize: Recognize): Promise<NumberRead | null> {
  let best = await readQuarter(photo, recognize, 0);
  for (const rotation of [90, 270] as const) {
    if (best && best.weight >= SURE_WEIGHT) break;
    const read = await readQuarter(rotatePixels(photo, rotation), recognize, rotation);
    if (read && (!best || read.weight > best.weight)) best = read;
  }
  if (!best) return null;
  const { weight: _weight, ...read } = best;
  return read;
}
